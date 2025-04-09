// supabase/functions/llm-chat-handler/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { createResponse, handleOptions } from '../_shared/headers.ts'

// Define types for expected request/response structures (can be refined)
interface ChatRequest {
  message: string;
  context?: { // Optional context, e.g., current contact page
    contactId?: string;
  };
  confirmation?: { // Sent when user confirms an action
    confirm: boolean;
    action_details: ActionDetails;
  };
  important_events?: Array<{
    type: 'birthday' | 'anniversary' | 'custom';
    date: string;
    name: string | null;
  }>;
}

interface ActionDetails {
  action: string; // e.g., 'create_contact', 'log_interaction', 'update_contact', 'delete_contact'
  params: Record<string, any>; // Parameters for the action
  contact_id?: string; // Resolved contact ID
}

interface ChatResponse {
  reply?: string; // Direct answer from LLM or system message
  confirmation_required?: boolean;
  message?: string; // Message to display for confirmation
  action_details?: ActionDetails; // Details needed for confirmation step
  error?: string;
}

// --- Helper: Check Premium/Trial Status ---
async function isUserPremiumOrTrial(supabaseClient: SupabaseClient, userId: string): Promise<boolean> {
  const { data, error } = await supabaseClient
    .from('subscriptions')
    .select('status, trial_end_date, valid_until')
    .eq('user_id', userId)
    .eq('plan_id', 'premium')
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116: No rows found (expected for free users)
    console.error('Error fetching subscription:', error);
    return false; // Default to false on error
  }

  if (!data) {
    return false; // No premium subscription found
  }

  const now = new Date();

  // Check if subscription is active and not expired
  if (data.status === 'active' && new Date(data.valid_until) > now) {
    return true;
  }

  // Check if trial is still valid
  if (data.trial_end_date) {
    const trialEndDate = new Date(data.trial_end_date);
    if (trialEndDate > now) {
      return true;
    }
  }

  return false; // Otherwise, not premium or on active trial
}
// --- Main Handler ---
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return handleOptions();
  }

  try {
    // 1. Initialize Supabase Client & Authenticate User
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '', // Use anon key for initial auth check
      {
        global: {
          headers: {
            Authorization: req.headers.get('Authorization') ?? ''
          }
        }
      }
    );

    const authorization = req.headers.get('Authorization');
    if (!authorization) {
      return createResponse({ error: 'Unauthorized: Missing token' }, { status: 401 });
    }

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      console.error('Auth Error:', userError);
      return createResponse({ error: 'Unauthorized: Invalid token' }, { status: 401 });
    }

    // Create a service role client for subsequent operations needing elevated privileges
    // IMPORTANT: Ensure SUPABASE_SERVICE_ROLE_KEY is set in your Edge Function environment variables
    const supabaseAdminClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );


    // 2. Check Premium/Trial Status
    const isAllowed = await isUserPremiumOrTrial(supabaseAdminClient, user.id);
    if (!isAllowed) {
      return createResponse({ error: 'Forbidden: This feature requires a Premium subscription or active trial.' }, { status: 403 });
    }

    // 3. Parse Request Body
    const requestBody: ChatRequest = await req.json();

    // 4. Handle Confirmation Flow OR Initial Request
    if (requestBody.confirmation) {
      // --- Confirmation Handling ---
      if (requestBody.confirmation.confirm && requestBody.confirmation.action_details) {
        const { action, params, contact_id } = requestBody.confirmation.action_details;
        console.log(`Executing confirmed action: ${action} for user ${user.id}`, params);

        // --- Action Execution Logic ---
        try {
          if (action === 'create_contact') {
            if (!params.name || !params.contact_frequency) {
              throw new Error('Name and contact frequency are required for creating a contact');
            }

            // Validate contact_frequency
            const validFrequencies = ['every_three_days', 'weekly', 'fortnightly', 'monthly', 'quarterly'];
            if (!validFrequencies.includes(params.contact_frequency)) {
              throw new Error(`Invalid contact frequency. Must be one of: ${validFrequencies.join(', ')}`);
            }
            // Validate important events if provided
            if (params.important_events) {
              // Check if events array is valid
              if (!Array.isArray(params.important_events)) {
                throw new Error("important_events must be an array");
              }

              // Maximum 5 events allowed
              if (params.important_events.length > 5) {
                throw new Error("Maximum of 5 important events allowed per contact");
              }

              // Check for duplicate birthday or anniversary
              const hasBirthday = params.important_events.filter(e => e.type === 'birthday').length > 1;
              const hasAnniversary = params.important_events.filter(e => e.type === 'anniversary').length > 1;
              if (hasBirthday) throw new Error("Only one birthday event allowed");
              if (hasAnniversary) throw new Error("Only one anniversary event allowed");

              // Validate each event
              params.important_events.forEach(event => {
                if (!['birthday', 'anniversary', 'custom'].includes(event.type)) {
                  throw new Error("Event type must be 'birthday', 'anniversary', or 'custom'");
                }
                
                if (!event.date || isNaN(new Date(event.date).getTime())) {
                  throw new Error("Each event must have a valid date");
                }

                if (event.type === 'custom' && (!event.name || event.name.length > 50)) {
                  throw new Error("Custom events must have a name between 1 and 50 characters");
                }
              });
            }

            // Validate social media platform if provided
            if (params.social_media_platform && !['linkedin', 'instagram', 'twitter'].includes(params.social_media_platform)) {
              throw new Error("Invalid social media platform. Must be one of: 'linkedin', 'instagram', 'twitter'");
            }

            // Validate preferred contact method if provided
            if (params.preferred_contact_method && !['call', 'message', 'social'].includes(params.preferred_contact_method)) {
              throw new Error("Invalid preferred contact method. Must be one of: 'call', 'message', 'social'");
            }

            const { data: contact, error: createError } = await supabaseAdminClient
              .from('contacts')
              .insert({
                user_id: user.id,
                name: params.name,
                contact_frequency: params.contact_frequency,
                phone: params.phone || null,
                social_media_platform: params.social_media_platform || null,
                social_media_handle: params.social_media_handle || null,
                preferred_contact_method: params.preferred_contact_method || null,
                notes: params.notes || null,
                // Skip next_contact_due as it will be set by calculate_next_contact_date
                last_contacted: new Date().toISOString(),
                missed_interactions: 0
              })
              .select()
              .single();

            if (createError) throw createError;
            if (!contact) throw new Error('Failed to create contact');

            // Add important events if provided
            if (params.important_events && params.important_events.length > 0) {
              const { error: eventsError } = await supabaseAdminClient
                .from('important_events')
                .insert(params.important_events.map(event => ({
                  contact_id: contact.id,
                  user_id: user.id,
                  type: event.type,
                  name: event.name,
                  date: event.date
                })));

              if (eventsError) {
                console.error('Error creating important events:', eventsError);
                // Don't fail the operation, but log the error
              }
            }

            // Recalculate next contact due date
            // Calculate next contact due date properly
            const { data: userPref } = await supabaseAdminClient
              .from('user_preferences')
              .select('timezone')
              .eq('user_id', user.id)
              .single();

            // Use UTC if no timezone preference is set
            const timezone = userPref?.timezone || 'UTC';
            const now = new Date(new Date().toLocaleString('en-US', { timeZone: timezone }));

            // Calculate next due date in user's timezone based on contact frequency
            const nextDueDate = new Date(now);
            const frequencyMap = {
              every_three_days: 3,
              weekly: 7,
              fortnightly: 14,
              monthly: 30,
              quarterly: 90
            };
            const days = frequencyMap[params.contact_frequency] || 30; // Default to monthly
            nextDueDate.setDate(nextDueDate.getDate() + days);

            // Update the contact with calculated next_contact_due
            const { error: updateError } = await supabaseAdminClient
              .from('contacts')
              .update({
                next_contact_due: nextDueDate.toISOString()
              })
              .eq('id', contact.id);

            if (updateError) {
              console.error('Error updating next contact date:', updateError);
              // Don't fail the operation, but log the error
            }

            // Create initial reminder
            const { error: reminderError } = await supabaseAdminClient
              .from('reminders')
              .insert({
                contact_id: contact.id,
                user_id: user.id,
                type: params.preferred_contact_method || 'message',
                due_date: nextDueDate.toISOString(),
                completed: false
              });

            if (reminderError) {
              console.error('Error creating reminder:', reminderError);
              // Don't fail the operation, but log the error
            }

            return createResponse({ reply: `Contact "${contact.name}" created successfully.` });

          } else if (action === 'log_interaction') {
            if (!contact_id) throw new Error("Contact ID is required for log_interaction.");
            
            // Validate interaction type
            if (!['call', 'message', 'social', 'meeting'].includes(params.type)) {
              throw new Error("Invalid interaction type. Must be one of: 'call', 'message', 'social', 'meeting'");
            }

            // Validate sentiment if provided
            if (params.sentiment && !['positive', 'neutral', 'negative'].includes(params.sentiment)) {
              throw new Error("Invalid sentiment. Must be one of: 'positive', 'neutral', 'negative'");
            }

            const { data: result, error: rpcError } = await supabaseAdminClient.rpc('log_interaction_and_update_contact', {
              p_contact_id: contact_id,
              p_user_id: user.id,
              p_type: params.type,
              p_date: params.date || new Date().toISOString(),
              p_notes: params.notes || null,
              p_sentiment: params.sentiment || null
            });

            if (rpcError) throw rpcError;
            if (!result || !result[0]?.interaction_id) throw new Error("Failed to log interaction");

            return createResponse({
              reply: `Interaction logged successfully${result.contact_updated ? ' and contact updated' : ''}.`
            });

          } else if (action === 'update_contact') {
            if (!contact_id) throw new Error("Contact ID is required for update_contact.");
            if (!params.updates || typeof params.updates !== 'object' || Object.keys(params.updates).length === 0) {
              throw new Error("Updates object with fields to change is required for update_contact.");
            }

            const contactUpdates: Record<string, any> = {};
            let newImportantEvents: any[] | null | undefined = undefined; // Store validated events separately
            let requiresRecalculation = false;

            // Validate each field in the updates object
            for (const field in params.updates) {
              const value = params.updates[field];

              switch (field) {
                case 'name':
                  if (typeof value !== 'string' || value.trim().length === 0) throw new Error("Name cannot be empty.");
                  contactUpdates[field] = value.trim();
                  break;
                case 'contact_frequency':
                  const validFrequencies = ['every_three_days', 'weekly', 'fortnightly', 'monthly', 'quarterly'];
                  if (!validFrequencies.includes(value)) throw new Error(`Invalid contact frequency.`);
                  contactUpdates[field] = value;
                  requiresRecalculation = true; // Frequency change requires recalculation
                  break;
                case 'phone':
                  // Allow null or valid phone format
                  if (value !== null && (typeof value !== 'string' /* Basic validation, refine if needed */)) throw new Error("Invalid phone format.");
                  contactUpdates[field] = value;
                  break;
                case 'social_media_platform':
                  if (value !== null && !['linkedin', 'instagram', 'twitter'].includes(value)) throw new Error("Invalid social media platform.");
                  contactUpdates[field] = value;
                  // Reset handle if platform is cleared or changed without a new handle
                  if (!params.updates.social_media_handle && contactUpdates.social_media_handle === undefined) {
                     contactUpdates.social_media_handle = null;
                  }
                  break;
                case 'social_media_handle':
                   // Allow null or string
                  if (value !== null && typeof value !== 'string') throw new Error("Invalid social media handle format.");
                  contactUpdates[field] = value;
                  break;
                case 'preferred_contact_method':
                  if (value !== null && !['call', 'message', 'social'].includes(value)) throw new Error("Invalid preferred contact method.");
                  contactUpdates[field] = value;
                  break;
                case 'notes':
                   // Allow null or string
                  if (value !== null && typeof value !== 'string') throw new Error("Invalid notes format.");
                  contactUpdates[field] = value;
                  break;
                case 'important_events':
                  // Validate the entire array if provided (null means clear events)
                  if (value === null) {
                    newImportantEvents = []; // Signal to delete all events
                  } else if (Array.isArray(value)) {
                    if (value.length > 5) throw new Error("Maximum of 5 important events allowed.");
                    const hasBirthday = value.filter(e => e.type === 'birthday').length > 1;
                    const hasAnniversary = value.filter(e => e.type === 'anniversary').length > 1;
                    if (hasBirthday) throw new Error("Only one birthday event allowed.");
                    if (hasAnniversary) throw new Error("Only one anniversary event allowed.");

                    value.forEach(event => {
                      if (!['birthday', 'anniversary', 'custom'].includes(event.type)) throw new Error("Invalid event type.");
                      if (!event.date || isNaN(new Date(event.date).getTime())) throw new Error("Invalid event date.");
                      if (event.type === 'custom' && (!event.name || event.name.length > 50)) throw new Error("Custom event name invalid.");
                    });
                    newImportantEvents = value; // Store validated array
                    requiresRecalculation = true; // Event changes require recalculation
                  } else {
                    throw new Error("important_events must be an array or null.");
                  }
                  break;
                default:
                  console.warn(`Ignoring unknown field in update_contact: ${field}`);
              }
            }

            // --- Perform Database Operations ---

            // 1. Update contacts table if there are changes
            if (Object.keys(contactUpdates).length > 0) {
              const { error: updateContactError } = await supabaseAdminClient
                .from('contacts')
                .update(contactUpdates)
                .eq('user_id', user.id) // Ensure user owns the contact
                .eq('id', contact_id);

              if (updateContactError) throw updateContactError;
            }

            // 2. Add or Update important events if provided
            if (newImportantEvents && newImportantEvents.length > 0) {
              // Fetch existing events to check limits and avoid duplicates/updates
              const { data: existingEventsData, error: fetchError } = await supabaseAdminClient
                .from('important_events')
                .select('id, type, name, date')
                .eq('contact_id', contact_id);

              if (fetchError) throw fetchError;
              const existingEvents = existingEventsData || [];

              for (const eventToProcess of newImportantEvents) {
                const existingEvent = existingEvents.find(e =>
                  e.type === eventToProcess.type &&
                  (e.type !== 'custom' || e.name === eventToProcess.name)
                );

                if (existingEvent) {
                  // --- Update existing event ---
                  if (existingEvent.date !== eventToProcess.date) {
                    const { error: updateEventError } = await supabaseAdminClient
                      .from('important_events')
                      .update({ date: eventToProcess.date })
                      .eq('id', existingEvent.id);
                    if (updateEventError) {
                       console.error(`Error updating event ${existingEvent.id}:`, updateEventError);
                       // Decide whether to throw or just log
                    }
                  }
                } else {
                  // --- Add new event ---
                  // Check limits before adding
                  if (existingEvents.length >= 5) {
                    console.warn(`Skipping add event: Max 5 events allowed for contact ${contact_id}`);
                    continue; // Skip this event
                  }
                  if (eventToProcess.type === 'birthday' && existingEvents.some(e => e.type === 'birthday')) {
                     console.warn(`Skipping add event: Birthday already exists for contact ${contact_id}`);
                     continue; // Skip this event
                  }
                  if (eventToProcess.type === 'anniversary' && existingEvents.some(e => e.type === 'anniversary')) {
                     console.warn(`Skipping add event: Anniversary already exists for contact ${contact_id}`);
                     continue; // Skip this event
                  }

                  // Insert the new event
                  const { error: insertEventError } = await supabaseAdminClient
                    .from('important_events')
                    .insert({
                      contact_id: contact_id,
                      user_id: user.id,
                      type: eventToProcess.type,
                      name: eventToProcess.name,
                      date: eventToProcess.date
                    });
                  if (insertEventError) {
                     console.error(`Error inserting new event for contact ${contact_id}:`, insertEventError);
                     // Decide whether to throw or just log
                  } else {
                     // Add the newly inserted event to our local list for subsequent limit checks
                     existingEvents.push({ id: 'temp', ...eventToProcess });
                  }
                }
              }
            }

            // 3. Recalculate next due date if needed (frequency or events changed)
            // Note: contacts.ts service handles this more robustly.
            // Here, we'll rely on the next interaction to trigger recalculation via log_interaction_and_update_contact
            // or potentially add a direct recalculate call if strictly necessary.
            // For now, we skip explicit recalculation here to avoid complexity.
            // if (requiresRecalculation) {
            //    // Consider calling a recalculate RPC or function if available/needed
            // }


            return createResponse({ reply: `Contact "${params.contact_name}" updated successfully.` });

          } else if (action === 'delete_contact') {
             if (!contact_id) throw new Error("Contact ID is required for delete_contact.");
             // Use service role to bypass RLS for cascade delete if needed, or ensure RLS allows delete
             const { error: deleteError } = await supabaseAdminClient
               .from('contacts')
               .delete()
               .eq('user_id', user.id) // RLS check
               .eq('id', contact_id);
             if (deleteError) throw deleteError;
             return createResponse({ reply: "Contact deleted successfully." });

          } else if (action === 'add_quick_reminder') {
            if (!contact_id) throw new Error("Contact ID is required for add_quick_reminder.");
            if (!params.name || !params.due_date) throw new Error("Reminder name and due date are required.");
            if (params.name.length > 150) throw new Error("Reminder name must be 150 characters or less.");
            if (isNaN(new Date(params.due_date).getTime())) throw new Error("Invalid due date format.");
            // Ensure proper year handling for dates
            const dueDate = new Date(params.due_date);
            const currentDate = new Date();
            // If year is not specified or incorrect, set it to current year
            if (dueDate.getFullYear() < currentDate.getFullYear()) {
                dueDate.setFullYear(currentDate.getFullYear());
            }
            // If date with current year is in the past, increment to next year
            if (dueDate < currentDate) {
                dueDate.setFullYear(currentDate.getFullYear() + 1);
            }
            // Update the params due_date with corrected date
            params.due_date = dueDate.toISOString();

            // Insert the quick reminder (with a name to distinguish it)
            const { data: reminder, error: insertReminderError } = await supabaseAdminClient
              .from('reminders')
              .insert({
                contact_id: contact_id,
                user_id: user.id,
                name: params.name.trim(), // Store the name
                type: 'message', // Default type for quick reminders
                due_date: params.due_date,
                completed: false
              })
              .select('id') // Select the ID for potential use
              .single();

            if (insertReminderError) {
               // Check for unique constraint violation (e.g., reminder on same day)
               if (insertReminderError.code === '23505') { // Adjust code based on actual Supabase error
                  throw new Error(`A reminder already exists for ${params.contact_name} on this date.`);
               }
               throw insertReminderError;
            }

            // If marked as important, also add a corresponding important event
            if (params.is_important === true) {
               // Check important event limits first
               const { count: eventCount, error: countError } = await supabaseAdminClient
                 .from('important_events')
                 .select('*', { count: 'exact', head: true })
                 .eq('contact_id', contact_id);

               if (countError) {
                  console.error("Error counting existing important events:", countError);
                  // Proceed without adding event, but log error
               } else if (eventCount !== null && eventCount >= 5) {
                  console.warn(`Skipping important event creation for quick reminder: Max 5 events reached for contact ${contact_id}`);
               } else {
                  // Add the important event
                  const { error: insertEventError } = await supabaseAdminClient
                    .from('important_events')
                    .insert({
                      contact_id: contact_id,
                      user_id: user.id,
                      type: 'custom', // Quick reminders become custom events
                      name: params.name.trim(), // Use reminder name
                      date: params.due_date
                    });

                  if (insertEventError) {
                     console.error(`Error creating important event for quick reminder ${reminder?.id}:`, insertEventError);
                     // Don't fail the whole operation, just log
                  }
               }
            }

            return createResponse({ reply: `Quick reminder "${params.name}" added for ${params.contact_name} on ${params.due_date}.` });

          } else if (action === 'get_contact_info') {
             // This action should ideally be handled in the initial request phase,
             // but include a fallback just in case.
             if (!contact_id) throw new Error("Contact ID is required for get_contact_info.");
             if (!params.info_needed) throw new Error("Info needed field is required.");
             const { data: contactInfo, error: infoError } = await supabaseAdminClient
               .from('contacts')
               .select(params.info_needed) // Select only the requested field
               .eq('user_id', user.id) // RLS check
               .eq('id', contact_id)
               .single();
             if (infoError) throw infoError;
             if (!contactInfo) return createResponse({ reply: "Could not find the requested information." });
             return createResponse({ reply: `The ${params.info_needed.replace(/_/g, ' ')} is: ${contactInfo[params.info_needed]}` });

          } else {
            console.warn(`Unhandled confirmed action: ${action}`);
            return createResponse({ error: `Action '${action}' is not implemented yet.` }, { status: 501 });
          }
        } catch (execError) {
           console.error(`Error executing action ${action}:`, execError);
           return createResponse({ error: `Failed to execute action: ${execError.message}` }, { status: 500 });
        }

      } else {
        // User cancelled
        return createResponse({ reply: "Action cancelled." });
      }

    } else {
      // --- Initial Request Processing ---
      const userMessage = requestBody.message;
      const context = requestBody.context; // e.g., { contactId: '...' }

      console.log(`Processing message for user ${user.id}: "${userMessage}"`, context);

      // 5. Call LLM (OpenRouter - Gemini Flash)
      const openRouterApiKey = Deno.env.get('GROQ_API_KEY');
      if (!openRouterApiKey) {
        throw new Error("GROQ_API_KEY environment variable not set.");
      }

      const systemPrompt = `You are an AI assistant for the TouchBase CRM. Your goal is to understand user requests and identify the correct action and parameters to interact with the CRM database.
      
      VALID FREQUENCY VALUES: 'every_three_days', 'weekly', 'fortnightly', 'monthly', 'quarterly'

IMPORTANT:
- When logging interactions, always use one of these exact types: 'call', 'message', 'social', 'meeting'. These are the only valid interaction types in the database.
- When users mention contact names, use whatever part of the name they provide (e.g., "Log that I spoke with Tom" or "What's Jo's number?"). The system will find exact or partial matches.

Available actions and their required parameters:
- create_contact: {
    name: string,
    contact_frequency: string,
    phone?: string,
    social_media_platform?: 'linkedin'|'instagram'|'twitter',
    social_media_handle?: string,
    preferred_contact_method?: 'call'|'message'|'social',
    notes?: string,
    important_events?: Array<{
      type: 'birthday'|'anniversary'|'custom',
      date: string,  // ISO 8601 format (YYYY-MM-DD)
      name: string|null // Required for custom events, null for birthday/anniversary
    }>
  }
- log_interaction: {
    contact_name: string,
    type: 'call'|'message'|'social'|'meeting'|'other',
    notes?: string,
    sentiment?: 'positive'|'neutral'|'negative',
    date?: string // ISO 8601, default to now if not specified
  }
- update_contact: {
    contact_name: string,
    updates: { // Object containing fields to update
      name?: string,
      contact_frequency?: string,
      phone?: string,
      social_media_platform?: 'linkedin'|'instagram'|'twitter'|null,
      social_media_handle?: string|null,
      preferred_contact_method?: 'call'|'message'|'social'|null,
      notes?: string|null,
      important_events?: Array<{ // Adds or Updates events. Does NOT replace the list unless explicitly requested.
        type: 'birthday'|'anniversary'|'custom',
        date: string, // ISO 8601 format (YYYY-MM-DD)
        name: string|null
      }> // Providing null or empty array here is ignored. Use delete_contact to remove events.
    }
  }
- get_contact_info: { contact_name: string, info_needed: string (e.g., 'phone', 'last_contacted', 'notes', 'next_contact_due', 'contact_frequency') }
- delete_contact: { contact_name: string }
- add_quick_reminder: {
    contact_name: string,
    name: string, // Description of the reminder
    due_date: string, // ISO 8601 format (YYYY-MM-DD)
    is_important?: boolean // Optional, defaults to false
  }
- check_reminders: { timeframe: 'today'|'tomorrow'|'week'|'month'|'date'|'custom', date?: string, start_date?: string, end_date?: string }

Rules:
- Always identify the contact by name using the 'contact_name' parameter. The backend will resolve the ID.
- If the user request is ambiguous (e.g., missing required parameters like type for log_interaction, name/due_date for reminder), ask for clarification. DO NOT guess parameters.
- If the request is a simple question not matching an action, provide a direct answer if possible or state you cannot perform that query. Use the 'reply' field for this.
- Respond ONLY with a valid JSON object containing 'action' and 'params', OR 'reply' for direct answers/clarifications, OR 'error'.
- Respond in raw JSON without markdown formatting
- Examples:
  {"action": "create_contact", "params": {"name": "Jane Doe", "contact_frequency": "weekly", "phone": "+1-555-0123", "preferred_contact_method": "call"}}
  {"action": "create_contact", "params": {"name": "John Smith", "contact_frequency": "monthly", "important_events": [{"type": "birthday", "date": "1990-04-07", "name": null}]}}
  {"action": "create_contact", "params": {"name": "Alice Brown", "contact_frequency": "weekly", "important_events": [{"type": "custom", "date": "2024-06-15", "name": "Graduation"}]}}
  {"action": "log_interaction", "params": {"contact_name": "Jane Doe", "type": "call", "notes": "Discussed project"}}
  {"action": "update_contact", "params": {"contact_name": "Jane Doe", "updates": {"phone": "+1-555-9876", "notes": "Updated notes here"}}}
  {"action": "update_contact", "params": {"contact_name": "John Smith", "updates": {"contact_frequency": "fortnightly"}}}
  {"action": "update_contact", "params": {"contact_name": "Alice Brown", "updates": {"important_events": [{"type": "birthday", "date": "1995-11-20", "name": null}]}}} // Replaces existing events
  {"action": "check_reminders", "params": {"timeframe": "today"}}
  {"action": "check_reminders", "params": {"timeframe": "week"}}
  {"action": "check_reminders", "params": {"timeframe": "date", "date": "2025-04-15"}}
  {"action": "check_reminders", "params": {"timeframe": "custom", "start_date": "2025-04-10", "end_date": "2025-04-20"}}
  {"action": "add_quick_reminder", "params": {"contact_name": "Jane Doe", "name": "Follow up on proposal", "due_date": "2025-04-15"}}
  {"action": "add_quick_reminder", "params": {"contact_name": "John Smith", "name": "Send birthday gift", "due_date": "2025-05-10", "is_important": true}}
  {"reply": "Which contact do you want to update?"}
  {"error": "Could not understand the request."}

  When checking reminders:
  - For queries about "today's reminders" or "what's due today" use timeframe: "today"
  - For queries about "tomorrow's reminders" or "what's due tomorrow" use timeframe: "tomorrow"
  - For queries about "this week's reminders" or "what's coming up" use timeframe: "week"
  - For queries about "next month" or "monthly reminders" use timeframe: "month"
  - For queries about a specific date (e.g., "April 15th", "next Friday") use timeframe: "date" with date parameter
  - For queries with date ranges, use timeframe: "custom" with start_date and end_date

  IMPORTANT: Respond in raw JSON ONLY. DO NOT include any other text or formatting.
`;

      const llmResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${openRouterApiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "google/gemini-2.0-flash-001",
          messages: [
            { role: "user", content: systemPrompt + "\n\nPrevious conversation:\n" +
              (Array.isArray(context?.previousMessages) ?
                context.previousMessages.map(m => `${m.role}: ${m.content}`).join("\n")
                : "") +
              "\n\nCurrent message:\n" + userMessage }
          ],
          response_format: { type: "json_object" }
        })
      });

      if (!llmResponse.ok) {
        const errorBody = await llmResponse.text();
        console.error("LLM API Error:", llmResponse.status, errorBody);
        throw new Error(`LLM API request failed: ${llmResponse.status}`);
      }

      const llmResult = await llmResponse.json();
      // Safely parse the potentially nested JSON string
      let llmJsonOutput: ChatResponse = {};
      try {
        const content = llmResult?.choices?.[0]?.message?.content;
        if (!content) {
           console.error('Empty LLM response:', llmResult);
           throw new Error("LLM response content is missing or empty.");
        }
        // Try to extract JSON from various formats
        let jsonContent = content.trim();

        // Check if content starts and ends with curly braces
        if (!jsonContent.startsWith('{') || !jsonContent.endsWith('}')) {
          // Try to extract from markdown code block if present
          if (content.includes('```json')) {
            const match = content.match(/```json\s*(\{.*?\})\s*```/s);
            if (match && match[1]) {
              jsonContent = match[1];
            }
          } else {
            // If we got a natural language response, wrap it as a reply
            jsonContent = JSON.stringify({ reply: content });
          }
        }

        try {
          llmJsonOutput = JSON.parse(jsonContent);
        } catch (innerError) {
          console.error("Parse error after cleanup:", innerError);
          llmJsonOutput = { reply: "I couldn't process that request properly. Please try rephrasing it." };
        }
      } catch (parseError) {
        console.error("Failed to parse LLM JSON output:", parseError, llmResult.choices?.[0]?.message?.content);
        throw new Error("Failed to parse response from AI model.");
      }


      console.log("LLM Output:", llmJsonOutput);

      // 6. Parse LLM Response & Prepare Confirmation/Reply
      if (llmJsonOutput.error) {
        return createResponse({ error: llmJsonOutput.error });
      } else if (llmJsonOutput.reply) {
        return createResponse({ reply: llmJsonOutput.reply });
      } else if (llmJsonOutput.action && llmJsonOutput.params) {
        const { action, params } = llmJsonOutput;
        const contactName = params.contact_name;

        // Check if contact name is required for this action
        const actionsRequiringContact = ['log_interaction', 'update_contact', 'delete_contact', 'get_contact_info'];
        const actionsNotRequiringContact = ['create_contact', 'check_reminders'];
        if (!contactName && actionsRequiringContact.includes(action)) {
           return createResponse({ reply: "Please specify which contact you're referring to." });
        }

        let resolvedContactId: string | undefined = context?.contactId;

        // Resolve contact name to ID if needed
        if (contactName) {
           // First try exact match
           const { data: exactMatches, error: exactError } = await supabaseAdminClient
             .from('contacts')
             .select('id, name')
             .eq('user_id', user.id)
             .ilike('name', contactName.trim())
             .limit(5);

           if (exactError) throw exactError;

           if (exactMatches && exactMatches.length === 1) {
             // Single exact match found
             resolvedContactId = exactMatches[0].id;
             params.contact_name = exactMatches[0].name;
           } else {
             // Try partial match if no exact match or multiple exact matches
             const { data: partialMatches, error: partialError } = await supabaseAdminClient
               .from('contacts')
               .select('id, name')
               .eq('user_id', user.id)
               .ilike('name', `%${contactName.trim()}%`)
               .limit(5);

             if (partialError) throw partialError;

             if (!partialMatches || partialMatches.length === 0) {
               return createResponse({ reply: `Sorry, I couldn't find any contacts matching "${contactName}".` });
             } else if (partialMatches.length > 1) {
               const options = partialMatches.map(c => c.name).join(', ');
               return createResponse({ reply: `Found multiple matching contacts: ${options}. Which one did you mean?` });
             } else {
               resolvedContactId = partialMatches[0].id;
               params.contact_name = partialMatches[0].name;
             }
           }
        }

        // If it's a 'get_contact_info' or 'check_reminders' action, execute it directly without confirmation
        if (action === 'check_reminders') {
           const now = new Date();
           let startDate = now;
           let endDate = now;

           switch (params.timeframe) {
             case 'today':
               // Keep default startDate and endDate as today
               endDate.setHours(23, 59, 59, 999);
               break;
             case 'tomorrow':
               startDate = new Date(now.setDate(now.getDate() + 1));
               startDate.setHours(0, 0, 0, 0);
               endDate = new Date(startDate);
               endDate.setHours(23, 59, 59, 999);
               break;
             case 'week':
               endDate = new Date(now);
               endDate.setDate(endDate.getDate() + 7);
               endDate.setHours(23, 59, 59, 999);
               break;
             case 'month':
               endDate = new Date(now);
               endDate.setMonth(endDate.getMonth() + 1);
               endDate.setHours(23, 59, 59, 999);
               break;
             case 'date':
               if (!params.date) {
                 return createResponse({ reply: "Please specify which date you want to check reminders for" });
               }
               startDate = new Date(params.date);
               if (isNaN(startDate.getTime())) {
                 return createResponse({ reply: "Invalid date format provided" });
               }
               startDate.setHours(0, 0, 0, 0);
               endDate = new Date(startDate);
               endDate.setHours(23, 59, 59, 999);
               break;
             case 'custom':
               if (!params.start_date || !params.end_date) {
                 return createResponse({ reply: "For custom timeframe, please specify both start_date and end_date" });
               }
               startDate = new Date(params.start_date);
               endDate = new Date(params.end_date);
               if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
                 return createResponse({ reply: "Invalid date format provided" });
               }
               break;
             default:
               return createResponse({ reply: "Invalid timeframe specified" });
           }

           const { data: reminders, error: remindersError } = await supabaseAdminClient
             .from('reminders')
             .select(`
               id,
               name,
               type,
               due_date,
               contacts:contact_id (
                 name
               )
             `)
             .eq('user_id', user.id)
             .eq('completed', false)
             .gte('due_date', startDate.toISOString())
             .lte('due_date', endDate.toISOString())
             .order('due_date', { ascending: true });

           if (remindersError) {
             console.error('Error fetching reminders:', remindersError);
             return createResponse({ reply: "Sorry, I encountered an error fetching your reminders." });
           }

           if (!reminders || reminders.length === 0) {
             const timeframeText = params.timeframe === 'today' ? 'today' :
                                 params.timeframe === 'tomorrow' ? 'tomorrow' :
                                 params.timeframe === 'week' ? 'this week' :
                                 params.timeframe === 'month' ? 'this month' :
                                 params.timeframe === 'date' ? 'on ' + new Date(params.date).toLocaleDateString() :
                                 'in the specified period';
             return createResponse({ reply: `You don't have any reminders due ${timeframeText}.` });
           }

           const reminderList = reminders.map(reminder => {
             const date = new Date(reminder.due_date).toLocaleDateString(undefined, {
               weekday: 'short',
               month: 'short',
               day: 'numeric',
               hour: '2-digit',
               minute: '2-digit'
             });
             return `- ${date}: ${reminder.contacts?.name || 'Unknown contact'} - ${reminder.name} (${reminder.type})`;
           }).join('\n');

           return createResponse({
             reply: `Here are your upcoming reminders:\n\n${reminderList}`
           });
        }

        if (action === 'get_contact_info') {
           if (!resolvedContactId) return createResponse({ reply: `Couldn't find contact "${contactName}" to get info.` });
           if (!params.info_needed) return createResponse({ reply: "What information do you need?" });

           // Validate requested field exists in contacts table
           const validFields = ['name', 'phone', 'social_media_platform', 'social_media_handle',
                              'last_contacted', 'next_contact_due', 'preferred_contact_method',
                              'notes', 'contact_frequency', 'missed_interactions'];
           if (!validFields.includes(params.info_needed)) {
              return createResponse({ reply: `Sorry, I cannot retrieve '${params.info_needed}'. Valid fields are: ${validFields.join(', ')}` });
           }

           const { data: contactInfo, error: infoError } = await supabaseAdminClient
             .from('contacts')
             .select(params.info_needed)
             .eq('user_id', user.id)
             .eq('id', resolvedContactId)
             .single();

           if (infoError) {
              console.error('Error fetching contact info:', infoError);
              return createResponse({ reply: `Sorry, I encountered an error retrieving that information.` });
           }

           if (!contactInfo || contactInfo[params.info_needed] === null || contactInfo[params.info_needed] === undefined) {
              return createResponse({ reply: `No ${params.info_needed.replace(/_/g, ' ')} found for ${params.contact_name}.` });
           }

           // Format dates nicely
           let value = contactInfo[params.info_needed];
           if (['last_contacted', 'next_contact_due'].includes(params.info_needed)) {
              if (!value) {
                 return createResponse({ reply: `No ${params.info_needed.replace(/_/g, ' ')} set for ${params.contact_name}.` });
              }
              try {
                 const date = new Date(value);
                 if (isNaN(date.getTime())) {
                    console.error('Invalid date:', value);
                    return createResponse({ reply: `Sorry, I encountered an error formatting the date.` });
                 }
                 value = date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
              } catch (error) {
                 console.error('Date formatting error:', error);
                 return createResponse({ reply: `Sorry, I encountered an error formatting the date.` });
              }
           }

           return createResponse({ reply: `The ${params.info_needed.replace(/_/g, ' ')} for ${params.contact_name} is: ${value}` });
        }


        // Ensure contact ID is resolved for actions that require it before confirmation
        if (!resolvedContactId && ['log_interaction', 'update_contact', 'delete_contact'].includes(action)) {
             return createResponse({ reply: `Please specify which contact you mean for the action: ${action}.` });
        }

        // --- Create User-Friendly Confirmation Message ---
        let confirmationMessage = "Please confirm the action:";
        const contactDisplayName = params.contact_name || "the current contact"; // Use resolved name

        switch (action) {
            case 'create_contact':
                confirmationMessage = `Create new contact with the following details?`;
                confirmationMessage += `\n- Name: ${params.name}`;
                confirmationMessage += `\n- Frequency: ${params.contact_frequency}`;
                if (params.phone) confirmationMessage += `\n- Phone: ${params.phone}`;
                if (params.social_media_platform) {
                    confirmationMessage += `\n- Social: ${params.social_media_platform}${params.social_media_handle ? ` - ${params.social_media_handle}` : ''}`;
                }
                if (params.preferred_contact_method) confirmationMessage += `\n- Preferred Method: ${params.preferred_contact_method}`;
                if (params.notes) confirmationMessage += `\n- Notes: "${params.notes}"`;
                if (params.important_events && params.important_events.length > 0) {
                    confirmationMessage += `\n- Important Events:`;
                    params.important_events.forEach(event => {
                        confirmationMessage += `\n  - ${event.type} (${event.date})${event.name ? `: ${event.name}` : ''}`;
                    });
                }
                break;
            case 'log_interaction':
                confirmationMessage = `Log ${params.type || 'interaction'} for ${contactDisplayName}?`;
                if (params.notes) confirmationMessage += ` Notes: "${params.notes}"`;
                if (params.sentiment) confirmationMessage += ` Sentiment: ${params.sentiment}`;
                break;
            case 'update_contact':
                confirmationMessage = `Update ${contactDisplayName} with the following changes?`;
                for (const field in params.updates) {
                   let value = params.updates[field];
                   let displayField = field.replace(/_/g, ' ');

                   if (field === 'important_events') {
                      // Describe the event changes more clearly
                      if (Array.isArray(value) && value.length > 0) {
                         confirmationMessage += `\n- Add/Update Important Events:`;
                         value.forEach(event => {
                            confirmationMessage += `\n  - ${event.type} (${event.date})${event.name ? `: ${event.name}` : ''}`;
                         });
                      }
                      // Skip displaying if events array is empty or null as it's ignored now
                   } else {
                      if (value === null) {
                         value = '(clear value)';
                      }
                      confirmationMessage += `\n- ${displayField}: ${value}`;
                   }
                }
                // Remove the last newline if nothing was added (e.g., only empty events array provided)
                if (confirmationMessage.endsWith('changes?')) {
                   confirmationMessage = `No valid updates detected for ${contactDisplayName}.`;
                   // Consider returning an error or reply instead of confirmation here
                }
                break;
            case 'delete_contact':
                confirmationMessage = `Are you sure you want to delete ${contactDisplayName}? This cannot be undone.`;
                break;
            case 'add_quick_reminder':
                confirmationMessage = `Add quick reminder "${params.name}" for ${contactDisplayName} due on ${params.due_date}?`;
                if (params.is_important) {
                   confirmationMessage += `\n(Marked as important)`;
                }
                break;
            default:
                 confirmationMessage = `Confirm action '${action}' for ${contactDisplayName}?`;
        }


        const actionDetails: ActionDetails = {
          action: action,
          params: params, // Pass original params from LLM
          contact_id: resolvedContactId
        };

        return createResponse({
          confirmation_required: true,
          message: confirmationMessage,
          action_details: actionDetails
        });

      } else {
        // Fallback if LLM response is unexpected
        console.warn("Unexpected LLM response format:", llmJsonOutput);
        return createResponse({ reply: "Sorry, I couldn't process that request. Can you try rephrasing?" });
      }
    }

  } catch (error) {
    console.error('Handler Error:', error);
    // Check if the error is a Response object (e.g., from createResponse)
    if (error instanceof Response) {
        return error;
    }
    return createResponse(
      { error: error.message || 'An internal error occurred' },
      { status: 500 }
    );
  }
});