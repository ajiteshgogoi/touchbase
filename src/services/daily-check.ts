import { BatchProcessor } from './batch-processor.js';
import { Contact, BatchConfig, DEFAULT_BATCH_CONFIG } from './batch-types.js';
import { createClient } from '@supabase/supabase-js';

function getNextContactDate(
  relationshipLevel: number,
  frequency: 'daily' | 'weekly' | 'fortnightly' | 'monthly' | 'quarterly' | null,
  missedInteractions: number
): Date {
  const today = new Date();
  let daysUntilNext = 7;

  if (frequency === 'daily') daysUntilNext = 1;
  else if (frequency === 'weekly') daysUntilNext = 7;
  else if (frequency === 'fortnightly') daysUntilNext = 14;
  else if (frequency === 'monthly') daysUntilNext = 30;
  else if (frequency === 'quarterly') daysUntilNext = 90;

  const levelMultiplier = 1 - (relationshipLevel - 1) * 0.1;
  daysUntilNext = Math.round(daysUntilNext * levelMultiplier);

  // Reduce interval for missed interactions (more urgent follow-up)
  if (missedInteractions > 0) {
    const urgencyMultiplier = Math.max(0.3, 1 - missedInteractions * 0.2);
    daysUntilNext = Math.max(1, Math.round(daysUntilNext * urgencyMultiplier));
  }

  // Set the next contact date
  const nextDate = new Date(today);
  nextDate.setDate(today.getDate() + daysUntilNext);
  return nextDate;
}

export async function runDailyCheckV2() {
  try {
    // Get environment variables
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const groqApiKey = process.env.GROQ_API_KEY;

    // Get batch configuration from environment variables with defaults from DEFAULT_BATCH_CONFIG
    const batchConfig: BatchConfig = {
      batchSize: parseInt(process.env.BATCH_SIZE || DEFAULT_BATCH_CONFIG.batchSize.toString(), 10),
      delayBetweenBatches: parseInt(process.env.DELAY_BETWEEN_BATCHES || DEFAULT_BATCH_CONFIG.delayBetweenBatches.toString(), 10),
      delayBetweenContacts: parseInt(process.env.DELAY_BETWEEN_CONTACTS || DEFAULT_BATCH_CONFIG.delayBetweenContacts.toString(), 10),
      maxContactsPerRun: parseInt(process.env.MAX_CONTACTS_PER_RUN || DEFAULT_BATCH_CONFIG.maxContactsPerRun.toString(), 10),
      retryAttempts: parseInt(process.env.RETRY_ATTEMPTS || DEFAULT_BATCH_CONFIG.retryAttempts.toString(), 10),
      retryDelay: parseInt(process.env.RETRY_DELAY || DEFAULT_BATCH_CONFIG.retryDelay.toString(), 10),
      maxRetryDelay: parseInt(process.env.MAX_RETRY_DELAY || DEFAULT_BATCH_CONFIG.maxRetryDelay.toString(), 10),
      backoffMultiplier: parseFloat(process.env.BACKOFF_MULTIPLIER || DEFAULT_BATCH_CONFIG.backoffMultiplier.toString()),
      rateLimitStatusCodes: DEFAULT_BATCH_CONFIG.rateLimitStatusCodes
    };

    if (!supabaseUrl || !supabaseServiceKey || !groqApiKey) {
      throw new Error('Missing required environment variables');
    }

    // Initialize Supabase client
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    // Get today's date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayEnd = new Date(today);
    todayEnd.setHours(23, 59, 59, 999);

    // Tomorrow's date range for new reminders
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate());  // Start from today to catch UTC conversions
    tomorrow.setHours(12, 0, 0, 0);  // Start from noon UTC today
    const tomorrowEnd = new Date(tomorrow);
    tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);  // End 24h later
    tomorrowEnd.setHours(12, 0, 0, 0);

    console.log('Checking for tomorrow\'s contacts between:', tomorrow.toISOString(), 'and', tomorrowEnd.toISOString());
    console.log('Using batch configuration:', JSON.stringify(batchConfig, null, 2));

    // First, get all user preferences to have timezone info
    const { data: userPreferences, error: preferencesError } = await supabaseClient
      .from('user_preferences')
      .select('user_id, timezone');

    if (preferencesError) throw preferencesError;

    // Create a map of user_id to timezone
    const userTimezones = new Map(
      (userPreferences || []).map(pref => [pref.user_id, pref.timezone || 'UTC'])
    );

    // Get contacts that might need attention
    const { data: missedContacts, error: missedError } = await supabaseClient
      .from('contacts')
      .select('*')
      .gte('next_contact_due', today.toISOString())
      .lte('next_contact_due', todayEnd.toISOString());

    if (missedError) throw missedError;

    // Handle missed interactions
    if (missedContacts && missedContacts.length > 0) {
      for (const contact of missedContacts) {
        const userTimezone = userTimezones.get(contact.user_id) || 'UTC';
        
        // Convert next_contact_due to user's timezone
        const dueDate = new Date(contact.next_contact_due);
        const dueDateInUserTz = new Date(dueDate.toLocaleString('en-US', { timeZone: userTimezone }));
        dueDateInUserTz.setHours(0, 0, 0, 0);

        // Get today in user's timezone
        const todayInUserTz = new Date(new Date().toLocaleString('en-US', { timeZone: userTimezone }));
        todayInUserTz.setHours(0, 0, 0, 0);

        // Skip if due date is in the future in user's timezone
        if (dueDateInUserTz.getTime() > todayInUserTz.getTime()) continue;

        // Get latest interaction to verify it's really missed
        const { data: latestInteraction } = await supabaseClient
          .from('interactions')
          .select('date')
          .eq('contact_id', contact.id)
          .order('date', { ascending: false })
          .limit(1)
          .single();

        // Check if there's an interaction today in user's timezone
        const hasInteractionToday = latestInteraction && (() => {
          const interactionDate = new Date(latestInteraction.date);
          const interactionDateInUserTz = new Date(interactionDate.toLocaleString('en-US', { timeZone: userTimezone }));
          interactionDateInUserTz.setHours(0, 0, 0, 0);
          return interactionDateInUserTz.getTime() === todayInUserTz.getTime();
        })();

        // Only process if no interaction today
        if (!hasInteractionToday) {
          const nextContactDue = getNextContactDate(
            contact.relationship_level,
            contact.contact_frequency,
            (contact.missed_interactions || 0) + 1
          );

          // Update contact first
          await supabaseClient
            .from('contacts')
            .update({
              missed_interactions: (contact.missed_interactions || 0) + 1,
              next_contact_due: nextContactDue.toISOString()
            })
            .eq('id', contact.id);

          // Then delete old reminder
          await supabaseClient
            .from('reminders')
            .delete()
            .eq('contact_id', contact.id);

          // Finally create new reminder
          await supabaseClient
            .from('reminders')
            .insert({
              contact_id: contact.id,
              user_id: contact.user_id,
              type: contact.preferred_contact_method || 'message',
              due_date: nextContactDue.toISOString(),
              description: contact.notes || undefined
            });
        }
      }
    }

    // Get all contacts that need attention tomorrow
    const { data: contacts, error: contactsError } = await supabaseClient
      .from('contacts')
      .select(`
        id,
        user_id,
        name,
        last_contacted,
        next_contact_due,
        preferred_contact_method,
        relationship_level,
        contact_frequency,
        social_media_handle,
        notes,
        missed_interactions,
        ai_last_suggestion,
        ai_last_suggestion_date,
        interactions (
          type,
          date,
          sentiment
        )
      `)
      .gte('next_contact_due', tomorrow.toISOString())
      .lte('next_contact_due', tomorrowEnd.toISOString());

    if (contactsError) {
      console.error('Error fetching tomorrow\'s contacts:', contactsError);
      throw contactsError;
    }

    console.log('Found contacts for tomorrow:', contacts?.length || 0);
    if (!contacts?.length) {
      return { message: 'No contacts need attention' };
    }

    // Get successfully processed contacts for tomorrow
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    const { data: processedContacts, error: processedError } = await supabaseClient
      .from('contact_processing_logs')
      .select('contact_id')
      .eq('processing_date', tomorrowStr)
      .eq('status', 'success');  // Only consider successfully processed contacts

    if (processedError) {
      console.error('Error fetching processed contacts:', processedError);
      throw processedError;
    }

    // Filter out successfully processed contacts
    const successfullyProcessedIds = new Set((processedContacts || []).map(p => p.contact_id));
    const unprocessedContacts = contacts.filter(c => !successfullyProcessedIds.has(c.id));

    if (!unprocessedContacts.length) {
      return { message: 'No unprocessed contacts need attention' };
    }

    // Initialize batch processor with configuration
    const batchProcessor = new BatchProcessor(
      supabaseUrl,
      supabaseServiceKey,
      groqApiKey,
      batchConfig
    );

    // Process contacts in batches
    const results = await batchProcessor.processBatches(unprocessedContacts as Contact[]);

    return {
      message: 'Daily check completed with batch processing',
      results,
      processingStats: {
        totalContacts: contacts.length,
        unprocessedContacts: unprocessedContacts.length,
        batchesProcessed: results.length,
        totalProcessed: results.reduce((acc, r) => acc + r.processedCount, 0),
        totalSuccess: results.reduce((acc, r) => acc + r.successCount, 0),
        totalErrors: results.reduce((acc, r) => acc + r.errorCount, 0),
        configuration: batchConfig
      }
    };
  } catch (error: any) {
    console.error('Daily check error:', error);
    throw error;
  }
}

// Execute if run directly (for CLI usage)
const entryPoint = process.argv[1] ? new URL(process.argv[1], 'file://').pathname : '';
if (import.meta.url.endsWith(entryPoint)) {
  runDailyCheckV2()
    .then(results => console.log(JSON.stringify(results, null, 2)))
    .catch(error => {
      console.error('Error running daily check:', error);
      process.exit(1);
    });
}