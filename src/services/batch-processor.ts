import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import {
  BatchConfig,
  BatchResult,
  Contact,
  ContactBatch,
  BatchProcessingResult,
  DEFAULT_BATCH_CONFIG
} from './batch-types.js';
import axios, { AxiosError } from 'axios';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';

// Enable necessary plugins
dayjs.extend(utc);
dayjs.extend(timezone);

const GROQ_API_URL = 'https://openrouter.ai/api/v1/chat/completions'; // LLM API endpoint //

export class BatchProcessor {
  private supabase: SupabaseClient;
  private config: BatchConfig;
  private groqApiKey: string;
  private processedCount: number = 0;

  constructor(
    supabaseUrl: string,
    supabaseKey: string,
    groqApiKey: string,
    config: Partial<BatchConfig> = {}
  ) {
    this.supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    this.config = { ...DEFAULT_BATCH_CONFIG, ...config };
    this.groqApiKey = groqApiKey;
  }

  async processBatches(contacts: Contact[]): Promise<BatchResult[]> {
    // Limit total contacts per run
    contacts = contacts.slice(0, this.config.maxContactsPerRun);
    const batches = this.createBatches(contacts);
    const results: BatchResult[] = [];

    for (const batch of batches) {
      try {
        // Check if we've hit the max contacts limit
        if (this.processedCount >= this.config.maxContactsPerRun) {
          console.log(`Reached max contacts limit (${this.config.maxContactsPerRun}). Stopping processing.`);
          break;
        }

        console.log(`Processing batch ${batch.batchId} with ${batch.contacts.length} contacts`);
        const result = await this.processBatch(batch);
        results.push(result);
        this.processedCount += result.successCount;

        // Add delay between batches if not the last batch
        if (batches.indexOf(batch) < batches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, this.config.delayBetweenBatches));
        }
      } catch (error: any) {
        console.error(`Error processing batch ${batch.batchId}:`, error);
        results.push(this.createErrorBatchResult(batch.batchId, error.message));

        // If we hit a rate limit, add an extra delay before the next batch
        if (this.isRateLimitError(error)) {
          const extraDelay = Math.min(
            this.config.maxRetryDelay,
            this.config.delayBetweenBatches * this.config.backoffMultiplier
          );
          console.log(`Rate limit detected, adding extra delay of ${extraDelay}ms before next batch`);
          await new Promise(resolve => setTimeout(resolve, extraDelay));
        }
      }
    }

    return results;
  }

  private createBatches(contacts: Contact[]): ContactBatch[] {
    const batches: ContactBatch[] = [];
    for (let i = 0; i < contacts.length; i += this.config.batchSize) {
      batches.push({
        batchId: uuidv4(),
        contacts: contacts.slice(i, i + this.config.batchSize),
      });
    }
    return batches;
  }

  private async processBatch(batch: ContactBatch): Promise<BatchResult> {
    const results = await Promise.all(
      batch.contacts.map(async (contact, index) => {
        // Add delay between contacts
        if (index > 0) {
          await new Promise(resolve => setTimeout(resolve, this.config.delayBetweenContacts));
        }
        return this.processContactWithRetry(contact, batch.batchId);
      })
    );

    const successResults = results.filter(r => r.status === 'success');
    const errorResults = results.filter(r => r.status === 'error');

    return {
      batchId: batch.batchId,
      processedCount: results.length,
      successCount: successResults.length,
      errorCount: errorResults.length,
      errors: errorResults.map(r => ({
        contactId: r.contactId,
        error: r.error || 'Unknown error',
      })),
    };
  }

  private isRateLimitError(error: any): boolean {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      return this.config.rateLimitStatusCodes.includes(axiosError.response?.status || 0);
    }
    return false;
  }

  private calculateBackoffDelay(attempt: number): number {
    const delay = Math.min(
      this.config.maxRetryDelay,
      this.config.retryDelay * Math.pow(this.config.backoffMultiplier, attempt - 1)
    );
    // Add some jitter to prevent all retries happening at exactly the same time
    return delay + Math.random() * 1000;
  }

  private async processContactWithRetry(
    contact: Contact,
    batchId: string,
    attempt: number = 1
  ): Promise<BatchProcessingResult> {
    try {
      return await this.processContact(contact, batchId);
    } catch (error: any) {
      const isRateLimit = this.isRateLimitError(error);
      const shouldRetry = attempt < this.config.retryAttempts && 
        (isRateLimit || error.message.toLowerCase().includes('rate limit'));

      if (shouldRetry) {
        const backoffDelay = this.calculateBackoffDelay(attempt);
        console.log(`Attempt ${attempt} failed for contact ${contact.id}. Retrying in ${backoffDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, backoffDelay));
        return this.processContactWithRetry(contact, batchId, attempt + 1);
      }
      throw error;
    }
  }

  private async processContact(
    contact: Contact,
    batchId: string
  ): Promise<BatchProcessingResult> {
    try {
      // Create processing log entry
      // Check for existing log and update if failed
      // Processing log tracks the status and retry attempts for each contact
      type ProcessingLog = {
        status: 'pending' | 'success' | 'error' | 'max_retries_exceeded';
        retry_count?: number;
        error_message?: string;
      };

      const MAX_RETRY_ATTEMPTS = 3; // Maximum number of retry attempts before giving up

      const { data: existingLog, error: fetchError } = await this.supabase
        .from('contact_processing_logs')
        .select('status, retry_count, error_message')
        .eq('contact_id', contact.id)
        .eq('processing_date', new Date().toISOString().split('T')[0])
        .maybeSingle<ProcessingLog>();

      if (fetchError) throw fetchError;

      // Check if max retries exceeded
      if (existingLog?.status === 'error' && (existingLog.retry_count || 0) >= MAX_RETRY_ATTEMPTS) {
        console.log(`Contact ${contact.id} has exceeded max retry attempts (${existingLog.retry_count}). Marking as failed.`);
        
        // Update status to indicate max retries exceeded
        await this.supabase
          .from('contact_processing_logs')
          .upsert({
            contact_id: contact.id,
            batch_id: batchId,
            status: 'max_retries_exceeded',
            processing_date: new Date().toISOString().split('T')[0],
            retry_count: existingLog.retry_count,
            last_error: existingLog.error_message
          }, {
            onConflict: 'contact_id,processing_date'
          });

        return {
          status: 'error',
          contactId: contact.id,
          error: 'Maximum retry attempts exceeded',
          details: `Failed after ${existingLog.retry_count} attempts. Last error: ${existingLog.error_message}`
        };
      }

      // Process if no log exists, has error status (with retries < 3), or already pending
      if (!existingLog || existingLog.status === 'error') {
        const upsertResult = await this.supabase
          .from('contact_processing_logs')
          .upsert({
            contact_id: contact.id,
            batch_id: batchId,
            status: 'pending',
            processing_date: new Date().toISOString().split('T')[0],
            retry_count: (existingLog?.retry_count || 0) + (existingLog ? 1 : 0),
            last_error: existingLog?.status === 'error' ? existingLog.error_message : null
          }, {
            onConflict: 'contact_id,processing_date'
          });

        if (upsertResult.error) throw upsertResult.error;
      } else {
        // Skip if already successfully processed
        return {
          status: 'success',
          contactId: contact.id
        };
      }

      // Check subscription and AI preferences
      const [subscriptionResult, preferencesResult] = await Promise.all([
        this.supabase
          .from('subscriptions')
          .select('subscription_plan_id, valid_until, trial_end_date')
          .eq('user_id', contact.user_id)
          .single(),
        this.supabase
          .from('user_preferences')
          .select('ai_suggestions_enabled')
          .eq('user_id', contact.user_id)
          .single()
      ]);

      if (subscriptionResult.error) throw subscriptionResult.error;
      if (preferencesResult.error) throw preferencesResult.error;

      const now = new Date();
      const subscription = subscriptionResult.data;
      const preferences = preferencesResult.data;

      const hasAccess = ((subscription?.subscription_plan_id === 'premium' || subscription?.subscription_plan_id === 'premium-annual') && subscription.valid_until && new Date(subscription.valid_until) > now) ||
        (subscription?.trial_end_date && new Date(subscription.trial_end_date) > now);

      // Process with LLM if premium/trial and AI suggestions enabled
      let suggestions;
      if (!preferences.ai_suggestions_enabled) {
        // Skip processing entirely if AI suggestions are disabled
        return {
          status: 'success',
          contactId: contact.id
        };
      } else if (!hasAccess) {
        suggestions = 'Upgrade to Premium to get personalised suggestions!';
      } else {
        suggestions = await this.getLLMSuggestions(contact);
      }

      // Update contact and log success
      const [updateResult, logResult] = await Promise.all([
        this.supabase
          .from('contacts')
          .update({
            ai_last_suggestion: suggestions,
            ai_last_suggestion_date: new Date().toISOString(),
          })
          .eq('id', contact.id),
        this.supabase
          .from('contact_processing_logs')
          .update({
            status: 'success',
          })
          .eq('contact_id', contact.id)
          .eq('batch_id', batchId),
      ]);

      if (updateResult.error) throw updateResult.error;
      if (logResult.error) throw logResult.error;

      return {
        status: 'success',
        contactId: contact.id,
      };
    } catch (error: any) {
      // Log error and update status
      await this.supabase
        .from('contact_processing_logs')
        .update({
          status: 'error',
          error_message: error.message || 'Unknown error',
        })
        .eq('contact_id', contact.id)
        .eq('batch_id', batchId);

      return {
        status: 'error',
        contactId: contact.id,
        error: error.message,
        details: JSON.stringify(error),
      };
    }
  }

  private async getLLMSuggestions(contact: Contact): Promise<string> {
    // Get user's timezone preference
    const { data: userPrefs } = await this.supabase
      .from('user_preferences')
      .select('timezone')
      .eq('user_id', contact.user_id)
      .single();

    const userTimezone = userPrefs?.timezone || 'UTC';
    
    const timeSinceLastContact = contact.last_contacted
      ? Math.floor(
          (Date.now() - new Date(contact.last_contacted).getTime()) /
            (1000 * 60 * 60 * 24)
        )
      : null;

    // Get important events
    const { data: importantEvents } = await this.supabase
      .from('important_events')
      .select('*')
      .eq('contact_id', contact.id);

    // Get tomorrow's date in user's timezone
    const tomorrow = dayjs().tz(userTimezone).add(1, 'day').startOf('day');

    // Find events occurring tomorrow
    const tomorrowEvents = (importantEvents || []).filter(event => {
      const eventDate = dayjs.utc(event.date);
      return eventDate.month() === tomorrow.month() &&
             eventDate.date() === tomorrow.date();
    });

    const userMessage = [
      "Analyze this contact's information and provide 2-3 highly impactful suggestions to strengthen the relationship:",
      '',
      'Contact Details:',
      `- Name: ${contact.name}`,
      `- Last contacted: ${
        timeSinceLastContact ? timeSinceLastContact + ' days ago' : 'Never'
      }`,
      `- Preferred method: ${contact.preferred_contact_method || 'Not specified'}`,
      `- Preferred contact frequency: ${
        contact.contact_frequency || 'Not specified'
      }`,
      `- Missed interactions: ${contact.missed_interactions}`,
      `- Notes: ${contact.notes || 'None'}`,
      '',
      // Add tomorrow's events section if any are happening
      ...(tomorrowEvents.length > 0 ? [
        'Important Events Tomorrow:',
        ...tomorrowEvents.map(event => {
          const eventType = event.type === 'custom' ? event.name :
                          event.type === 'birthday' ? 'Birthday' : 'Anniversary';
          return `- ${eventType}! Make sure to acknowledge this special day`;
        }),
        ''
      ] : []),
      'Recent Activity (chronological):',
      `${
        (contact.interactions || [])
          .sort(
            (a, b) =>
              new Date(b.date).getTime() - new Date(a.date).getTime()
          )
          .slice(0, 2)
          .map(
            i =>
              `- ${new Date(i.date).toLocaleDateString()}: ${i.type} (${
                i.sentiment || 'neutral'
              })`
          )
          .join('\n') || 'None'
      }`,
      '',
      'Rules for Suggestions:',
      '1. Be casual and friendly. Write like you\'re giving advice to a friend',
      '2. Must be actionable today or tomorrow',
      '3. For future dates (birthdays, anniversaries), suggest planning ahead instead of belated wishes',
      '4. Each suggestion starts with [📞 call], [💬 text], [📱 social] or [📧 email]',
      '5. Keep it short and simple — no explanations needed',
      '6. Avoid adding any addtional text before or after the suggestions (eg. "Okay here\'s how you can reconnect..."',
      '7. Skip if nothing meaningful to suggest',
      '',
      'Provide ONLY the most impactful 1-2 suggestions, each on a new line starting with "•"',
    ].join('\n');

    const groqResponse = await axios.post(
      GROQ_API_URL,
      {
        model: 'google/gemini-2.0-flash-lite-001', // Set LLM model here //
        messages: [
          {
            role: 'system',
            content: 'You help people stay in touch with friends and family by suggesting natural, casual ways to reach out.',
          },
          {
            role: 'user',
            content: userMessage,
          },
        ],
        temperature: 0.5, // Set LLM temperature here //
        max_tokens: 500, //Set LLM max tokens here //
      },
      {
        headers: {
          Authorization: `Bearer ${this.groqApiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!groqResponse.data?.choices?.[0]?.message?.content) {
      throw new Error(
        'Invalid response structure from Groq API: ' +
          JSON.stringify(groqResponse.data)
      );
    }

    return groqResponse.data.choices[0].message.content;
  }

  private createErrorBatchResult(batchId: string, error: string): BatchResult {
    return {
      batchId,
      processedCount: 0,
      successCount: 0,
      errorCount: 1,
      errors: [
        {
          contactId: 'batch',
          error,
        },
      ],
    };
  }
}