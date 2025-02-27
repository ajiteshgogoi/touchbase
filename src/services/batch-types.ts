interface Interaction {
  type: string;
  date: string;
  sentiment?: string;
}

interface Contact {
  id: string;
  user_id: string;
  name: string;
  last_contacted: string | null;
  next_contact_due: string | null;
  preferred_contact_method: 'call' | 'message' | 'social' | null;
  notes: string | null;
  relationship_level: 1 | 2 | 3 | 4 | 5;
  social_media_handle: string | null;
  contact_frequency: 'every_three_days' | 'weekly' | 'fortnightly' | 'monthly' | 'quarterly' | null;
  ai_last_suggestion: string | null;
  ai_last_suggestion_date: string | null;
  missed_interactions: number;
  interactions: Interaction[];
}

export interface BatchConfig {
  batchSize: number;                   // Number of contacts per batch (recommended: 20)
  delayBetweenBatches: number;        // Delay between batches in milliseconds (recommended: 5000)
  delayBetweenContacts: number;       // Delay between processing each contact in milliseconds (recommended: 1000)
  maxContactsPerRun: number;          // Maximum contacts to process in a single workflow run (recommended: 100)
  retryAttempts: number;              // Number of retry attempts for failed requests (recommended: 3)
  retryDelay: number;                 // Initial delay between retries in milliseconds (recommended: 2000)
  maxRetryDelay: number;              // Maximum delay for exponential backoff (recommended: 30000)
  backoffMultiplier: number;          // Multiplier for exponential backoff (recommended: 2)
  rateLimitStatusCodes: number[];     // HTTP status codes that indicate rate limiting
}

export interface BatchResult {
  batchId: string;
  processedCount: number;
  successCount: number;
  errorCount: number;
  errors: Array<{
    contactId: string;
    error: string;
  }>;
}

export interface BatchProcessingResult {
  status: 'pending' | 'success' | 'error';
  contactId: string;
  error?: string;
  details?: string;
}

export interface ContactBatch {
  batchId: string;
  contacts: Contact[];
}

export const DEFAULT_BATCH_CONFIG: BatchConfig = {
  batchSize: 20,                // 20 contacts per batch
  delayBetweenBatches: 5000,   // 5 seconds between batches
  delayBetweenContacts: 1000,  // 1 second between contacts
  maxContactsPerRun: 100,      // Maximum 100 contacts per workflow run
  retryAttempts: 3,            // 3 retry attempts
  retryDelay: 2000,            // Initial 2 second delay
  maxRetryDelay: 30000,        // Maximum 30 second delay
  backoffMultiplier: 2,        // Double the delay each retry
  rateLimitStatusCodes: [429, 503] // Common rate limit status codes
};

export type { Contact, Interaction };