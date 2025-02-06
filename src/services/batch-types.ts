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
  contact_frequency: 'daily' | 'weekly' | 'fortnightly' | 'monthly' | 'quarterly' | null;
  ai_last_suggestion: string | null;
  ai_last_suggestion_date: string | null;
  missed_interactions: number;
  interactions: Interaction[];
}

export interface BatchConfig {
  batchSize: number;
  delayBetweenBatches: number;  // in milliseconds
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

export type { Contact, Interaction };