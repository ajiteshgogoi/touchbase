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

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

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
      const { error: logError } = await this.supabase
        .from('contact_processing_logs')
        .insert({
          contact_id: contact.id,
          batch_id: batchId,
          status: 'pending',
          processing_date: new Date().toISOString().split('T')[0],
        });

      if (logError) throw logError;

      // Check subscription status
      const { data: subscription, error: subError } = await this.supabase
        .from('subscriptions')
        .select('plan_id, valid_until')
        .eq('user_id', contact.user_id)
        .single();

      if (subError) throw subError;

      const isPremium =
        subscription?.plan_id === 'premium' &&
        subscription.valid_until &&
        new Date(subscription.valid_until) > new Date();

      // Process with LLM if premium
      let suggestions;
      if (isPremium) {
        suggestions = await this.getLLMSuggestions(contact);
      } else {
        suggestions =
          '<div class="bg-yellow-50 p-3 rounded-lg"><strong>Important:</strong> Upgrade to premium to get advanced AI suggestions!</div>';
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
    const timeSinceLastContact = contact.last_contacted
      ? Math.floor(
          (Date.now() - new Date(contact.last_contacted).getTime()) /
            (1000 * 60 * 60 * 24)
        )
      : null;

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
      `- Relationship level: ${contact.relationship_level}/5`,
      `- Notes: ${contact.notes || 'None'}`,
      '',
      'Recent Activity (chronological):',
      `${
        (contact.interactions || [])
          .sort(
            (a, b) =>
              new Date(a.date).getTime() - new Date(b.date).getTime()
          )
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
      '1. Must be specific to their context and personal details — no generic advice',
      '2. Must be actionable within 24-48 hours',
      '3. Must clearly contribute to relationship growth',
      '4. Each suggestion should start with "[type: call/message/social]"',
      '5. Keep suggestions concise and impactful',
      '6. If no clear opportunities exist, return no suggestions',
      '',
      'Provide ONLY the most impactful 1-2 suggestions, each on a new line starting with "•"',
    ].join('\n');

    const groqResponse = await axios.post(
      GROQ_API_URL,
      {
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content:
              'You are a relationship manager assistant helping users maintain meaningful connections.',
          },
          {
            role: 'user',
            content: userMessage,
          },
        ],
        temperature: 0.7,
        max_tokens: 250,
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