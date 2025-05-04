import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
// No UUID import needed, using Web Crypto API
import { createResponse, handleOptions } from '../_shared/headers.ts';

// Environment variables
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const BREVO_API_KEY = Deno.env.get('BREVO_API_KEY');

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !BREVO_API_KEY) {
  console.error('Missing environment variables');
  throw new Error('Missing environment variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or BREVO_API_KEY');
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// --- Configuration ---
const SUPABASE_USER_BATCH_SIZE = 500; // How many users to fetch from Supabase at a time
const BREVO_CONTACT_BATCH_SIZE = 90; // Max contacts per Brevo batch API call (check Brevo docs for limits)
const DELAY_BETWEEN_BREVO_BATCHES_MS = 500; // Delay to avoid rate limiting

// --- Types ---
interface UserInfo {
  id: string;
  email: string;
}

interface UserData extends UserInfo {
  email: string;
  last_interaction_logged: string | null;
  subscription_plan_id: string | null;
  subscription_status: string | null; // Added subscription status
}

// --- Supabase Data Fetching & Logging ---

async function getActiveUserBatch(supabase: SupabaseClient, page: number): Promise<UserInfo[]> {
  const { data: usersResponse, error } = await supabase.auth.admin.listUsers({
    page: page + 1, // API is 1-based
    perPage: SUPABASE_USER_BATCH_SIZE,
  });

  if (error) {
    console.error(`Error fetching users (page ${page}):`, error);
    throw new Error(`Failed to fetch users: ${error.message}`);
  }

  if (!usersResponse || usersResponse.users.length === 0) {
    return []; // No more users
  }

  return usersResponse.users
    .filter(user => user.email) // Ensure email exists
    .map(user => ({ id: user.id, email: user.email! }));
}

async function getBatchInteractionData(supabase: SupabaseClient, userIds: string[]): Promise<Map<string, string | null>> {
  // Use a CTE and DISTINCT ON to get the latest interaction per user_id in one query
  const { data, error } = await supabase
    .from('interactions')
    .select('user_id, date')
    .in('user_id', userIds)
    .order('user_id') // Required for DISTINCT ON
    .order('date', { ascending: false }); // Get latest date first per user

  // Note: Supabase client might not directly support DISTINCT ON easily.
  // If the above doesn't work as expected, fallback to fetching all and processing in code,
  // or use an RPC function. For simplicity, let's process in code for now.

  const interactionMap = new Map<string, string | null>();
  if (error) {
    console.error('Error fetching batch interaction data:', error);
    // Initialize map with nulls for all requested users on error
    userIds.forEach(id => interactionMap.set(id, null));
    return interactionMap;
  }

  // Process results to get the latest date per user
  const latestDates: { [userId: string]: string } = {};
  data?.forEach(row => {
    if (!latestDates[row.user_id] || new Date(row.date) > new Date(latestDates[row.user_id])) {
      latestDates[row.user_id] = row.date;
    }
  });

  userIds.forEach(id => interactionMap.set(id, latestDates[id] ?? null));
  return interactionMap;
}

async function getBatchSubscriptionData(supabase: SupabaseClient, userIds: string[]): Promise<Map<string, { planId: string | null; status: string | null }>> {
  // Similar approach for subscriptions, getting the latest record per user
  const { data, error } = await supabase
    .from('subscriptions')
    .select('user_id, subscription_plan_id, status, created_at')
    .in('user_id', userIds)
    .order('user_id')
    .order('created_at', { ascending: false });

  const subscriptionMap = new Map<string, { planId: string | null; status: string | null }>();
  if (error) {
    console.error('Error fetching batch subscription data:', error);
    userIds.forEach(id => subscriptionMap.set(id, { planId: null, status: null }));
    return subscriptionMap;
  }

  // Process results to get the latest subscription per user
  const latestSubs: { [userId: string]: { planId: string | null; status: string | null } } = {};
  data?.forEach(row => {
    if (!latestSubs[row.user_id]) { // Only take the first (latest) record per user due to ordering
      latestSubs[row.user_id] = {
        planId: row.subscription_plan_id,
        // Filter for active status here if needed, or return the latest status regardless
        // status: row.status === 'active' ? row.status : null // Example: only care about active status
        status: row.status ?? 'none' // Return latest status or 'none'
      };
    }
  });

  userIds.forEach(id => subscriptionMap.set(id, latestSubs[id] ?? { planId: null, status: 'none' }));
  return subscriptionMap;
}

async function logBatchStatus(
  supabase: SupabaseClient,
  runId: string,
  contacts: UserData[],
  status: 'pending' | 'success' | 'error' | 'skipped',
  errorMessage?: string | null,
  attributesAttempted?: { [email: string]: object } | null
) {
  const logsToUpdate = contacts.map(contact => ({
    run_id: runId,
    user_id: contact.id,
    email: contact.email,
    status: status,
    error_message: errorMessage,
    // Only include attributes_attempted if provided and relevant (e.g., for pending/error)
    attributes_attempted: attributesAttempted ? attributesAttempted[contact.email] : undefined,
    processed_at: ['success', 'error', 'skipped'].includes(status) ? new Date().toISOString() : null,
  }));

  // Use upsert to handle both initial 'pending' inserts and later status updates
  const { error } = await supabase
    .from('brevo_update_logs')
    .upsert(logsToUpdate, { onConflict: 'run_id, email' }); // Assuming unique constraint or PK on (run_id, email)

  if (error) {
    console.error(`Error logging batch status (${status}) to database:`, error);
    // Decide if this failure is critical
  } else {
     console.log(`Logged ${logsToUpdate.length} contacts with status '${status}' for run ${runId}.`);
  }
}


// --- Brevo API Interaction (Batch with Logging) ---

async function updateBrevoBatch(
    supabase: SupabaseClient,
    runId: string,
    contactsInBatch: UserData[]
): Promise<{ successCount: number; skippedCount: number; errorCount: number }> {

  let successCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  // 1. Identify contacts with actual changes and those to be skipped
  const contactsToAttemptUpdate: UserData[] = [];
  const contactsToSkip: UserData[] = [];
  const attributesToSend: { [email: string]: object } = {}; // Store attributes for logging

  contactsInBatch.forEach(user => {
    const attributes: { [key: string]: any } = {};
    if (user.last_interaction_logged) {
      attributes['LAST_INTERACTION_LOGGED'] = user.last_interaction_logged.split('T')[0];
    }
    if (user.subscription_plan_id !== undefined) {
      attributes['SUBSCRIPTION_PLAN_ID'] = user.subscription_plan_id;
    }
    if (user.subscription_status !== undefined) {
      attributes['SUBSCRIPTION_STATUS'] = user.subscription_status;
    }

    if (Object.keys(attributes).length > 0) {
      contactsToAttemptUpdate.push(user);
      attributesToSend[user.email] = attributes; // Store for logging
    } else {
      contactsToSkip.push(user);
    }
  });

  // 2. Log skipped contacts
  if (contactsToSkip.length > 0) {
    console.log(`${contactsToSkip.length} contacts in this batch have no attribute changes, marking as skipped.`);
    await logBatchStatus(supabase, runId, contactsToSkip, 'skipped');
    skippedCount = contactsToSkip.length;
  }

  // 3. Prepare and send batch to Brevo if there are contacts to update
  if (contactsToAttemptUpdate.length === 0) {
    console.log("No contacts with changes in this batch, skipping Brevo API call.");
    return;
    return { successCount, skippedCount, errorCount }; // No attempts made
  }

  const batchPayload = {
    contacts: contactsToAttemptUpdate.map(user => ({
      email: user.email,
      attributes: attributesToSend[user.email] // Use pre-calculated attributes
    }))
  };

  console.log(`Sending batch update to Brevo for ${batchPayload.contacts.length} contacts.`);
  let brevoApiError: Error | null = null;
  let brevoErrorMessage: string | null = null;
  let brevoSuccess = false;

  try {
    const response = await fetch(`https://api.brevo.com/v3/contacts/batch`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'api-key': BREVO_API_KEY
      },
      body: JSON.stringify(batchPayload)
    });

    if (response.status === 204) {
      console.log(`Successfully processed Brevo batch update for ${batchPayload.contacts.length} contacts.`);
      brevoSuccess = true;
    } else {
      const responseText = await response.text();
      brevoErrorMessage = `Brevo batch API error (Status: ${response.status}): ${responseText}`;
      console.error(brevoErrorMessage);
      // Assume entire batch failed if API call itself fails
    }
  } catch (error) {
    console.error(`Network or other error calling Brevo batch API:`, error);
    brevoApiError = error;
    brevoErrorMessage = error.message;
    // Assume entire batch failed
  }

  // 4. Log final status based on API call outcome
  if (brevoSuccess) {
    await logBatchStatus(supabase, runId, contactsToAttemptUpdate, 'success');
    successCount = contactsToAttemptUpdate.length;
  } else {
    await logBatchStatus(supabase, runId, contactsToAttemptUpdate, 'error', brevoErrorMessage, attributesToSend);
    errorCount = contactsToAttemptUpdate.length;
  }

  return { successCount, skippedCount, errorCount };
}


// --- Helpers ---
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));


// --- Main Handler ---

serve(async (req) => {
  const runId = crypto.randomUUID(); // Use Web Crypto API
  console.log(`Starting daily Brevo update run ID: ${runId}`);
  console.log(`Received ${req.method} request for ${req.url}`);

  if (req.method === 'OPTIONS') {
    return handleOptions();
  }

  if (req.method !== 'POST' && req.method !== 'GET') { // Allow GET for simple trigger/health check
     console.warn(`Method ${req.method} not allowed.`);
     return createResponse({ error: 'Method Not Allowed' }, { status: 405 });
  }

  // Optional: Add authentication check here if needed

  try {
    console.log('Starting daily Brevo update process with batching...');
    let supabasePage = 0;
    let totalUsersFetched = 0;
    let totalBrevoBatchesSent = 0;
    let totalSuccess = 0;
    let totalSkipped = 0;
    let totalErrors = 0;

    while (true) {
      console.log(`[Run ${runId}] Fetching Supabase user batch ${supabasePage}...`);
      const userBatch = await getActiveUserBatch(supabaseAdmin, supabasePage);

      if (userBatch.length === 0) {
        console.log(`[Run ${runId}] No more users found in Supabase.`);
        break; // Exit loop when no more users
      }

      console.log(`[Run ${runId}] Processing ${userBatch.length} users from Supabase batch ${supabasePage}.`);
      totalUsersFetched += userBatch.length;
      const userIds = userBatch.map(u => u.id);

      // Log initial 'pending' status for this batch
      // Note: We create UserData stubs here just for logging pending status.
      const pendingUserData = userBatch.map(u => ({ ...u, last_interaction_logged: null, subscription_plan_id: null, subscription_status: null }));
      await logBatchStatus(supabaseAdmin, runId, pendingUserData, 'pending');


      try {
        // Fetch additional data for the current batch of users in parallel
        console.log(`[Run ${runId}] Fetching interaction and subscription data for ${userIds.length} users...`);
        const [interactionMap, subscriptionMap] = await Promise.all([
          getBatchInteractionData(supabaseAdmin, userIds),
          getBatchSubscriptionData(supabaseAdmin, userIds)
        ]);
        console.log(`[Run ${runId}] Data fetched.`);

        // Prepare full UserData objects for the batch
        const userDataBatch: UserData[] = userBatch.map(user => ({
          ...user,
          last_interaction_logged: interactionMap.get(user.id) ?? null,
          subscription_plan_id: subscriptionMap.get(user.id)?.planId ?? null,
          subscription_status: subscriptionMap.get(user.id)?.status ?? 'none'
        }));

        // Process Brevo updates in chunks
        for (let i = 0; i < userDataBatch.length; i += BREVO_CONTACT_BATCH_SIZE) {
          const brevoChunk = userDataBatch.slice(i, i + BREVO_CONTACT_BATCH_SIZE);
          const currentBrevoBatchIndex = totalBrevoBatchesSent + 1;
          console.log(`[Run ${runId}] Processing Brevo batch ${currentBrevoBatchIndex} (Chunk ${i / BREVO_CONTACT_BATCH_SIZE + 1} of Supabase batch ${supabasePage}) with ${brevoChunk.length} contacts.`);

          const { successCount, skippedCount, errorCount } = await updateBrevoBatch(supabaseAdmin, runId, brevoChunk);
          totalSuccess += successCount;
          totalSkipped += skippedCount;
          totalErrors += errorCount;
          totalBrevoBatchesSent++;

          // Add delay between Brevo API calls if more chunks remain in this Supabase batch
          if (i + BREVO_CONTACT_BATCH_SIZE < userDataBatch.length) {
             console.log(`[Run ${runId}] Waiting ${DELAY_BETWEEN_BREVO_BATCHES_MS}ms before next Brevo batch...`);
             await delay(DELAY_BETWEEN_BREVO_BATCHES_MS);
          }
        }

      } catch (batchProcessingError) {
         // Catch errors during data fetching or the updateBrevoBatch loop
         console.error(`[Run ${runId}] Error processing Supabase batch ${supabasePage}:`, batchProcessingError);
         // Mark remaining pending logs in this Supabase batch as error
         const remainingUsers = userBatch.slice(totalSuccess + totalSkipped + totalErrors); // Estimate remaining
         if (remainingUsers.length > 0) {
            await logBatchStatus(supabaseAdmin, runId, remainingUsers.map(u => ({ ...u, last_interaction_logged: null, subscription_plan_id: null, subscription_status: null })), 'error', batchProcessingError.message);
            totalErrors += remainingUsers.length;
         }
         // Decide whether to continue to the next Supabase batch or stop
         // break; // Uncomment to stop on first critical batch error
      }

      // Check if it was the last page from Supabase
      if (userBatch.length < SUPABASE_USER_BATCH_SIZE) {
        console.log(`[Run ${runId}] Last batch of users processed from Supabase.`);
        break;
      }

      supabasePage++;
      // Optional: Add a small delay between Supabase batches if needed
      // await delay(100);
    }

    const summary = `Brevo update run ${runId} complete. Users Fetched: ${totalUsersFetched}, Brevo Batches Sent: ${totalBrevoBatchesSent}, Success: ${totalSuccess}, Skipped: ${totalSkipped}, Errors: ${totalErrors}`;
    console.log(summary);
    return createResponse({ message: summary, runId: runId });

  } catch (error) {
    console.error(`[Run ${runId}] Critical error in update-brevo function:`, error);
    return createResponse(
      {
        error: 'Internal Server Error',
        details: error.message
      },
      { status: 500 }
    );
  }
});

console.log('update-brevo function (batch & logging enabled) deployed and listening...');