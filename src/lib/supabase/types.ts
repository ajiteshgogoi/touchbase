export interface BasicContact {
  id: string;
  name: string;
  last_contacted: string | null;
  next_contact_due: string | null;
  contact_frequency: 'every_three_days' | 'weekly' | 'fortnightly' | 'monthly' | 'quarterly';
  missed_interactions: number;
}

export interface Contact extends BasicContact {
  id: string;
  user_id: string;
  name: string;
  phone?: string;
  social_media_handle?: string;
  last_contacted: string | null;
  next_contact_due: string | null;
  preferred_contact_method: 'call' | 'message' | 'social' | null;
  notes: string | null;
  contact_frequency: 'every_three_days' | 'weekly' | 'fortnightly' | 'monthly' | 'quarterly';
  ai_last_suggestion: string | null;
  ai_last_suggestion_date: string | null;
  missed_interactions: number;
  created_at: string;
  updated_at: string;
}

export interface ImportantEvent {
  id: string;
  contact_id: string;
  user_id: string;
  type: 'birthday' | 'anniversary' | 'custom';
  name: string | null; // Required for custom events, optional for birthday/anniversary
  date: string;
  created_at: string;
  updated_at: string;
}

export interface Interaction {
  id: string;
  user_id: string;
  contact_id: string;
  type: 'call' | 'message' | 'social' | 'meeting';
  date: string;
  notes: string | null;
  sentiment: 'positive' | 'neutral' | 'negative' | null;
  created_at: string;
}

export interface Reminder {
  id: string;
  contact_id: string;
  user_id: string;
  type: 'call' | 'message' | 'social';
  name?: string;  // Optional name for quick reminders
  due_date: string;
  completed: boolean;
  created_at: string;
}

export interface QuickReminderInput {
  contact_id: string;
  name: string;
  due_date: string;
  type: 'call' | 'message' | 'social';
  is_important?: boolean;
}

export interface UserPreferences {
  id: string;
  user_id: string;
  notification_enabled: boolean;
  theme: 'light' | 'dark' | 'system';
  timezone: string;
  ai_suggestions_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface PushSubscription {
  id: string;
  user_id: string;
  fcm_token: string;
  device_id: string;
  device_name: string | null;
  device_type: 'web' | 'android' | 'ios';
  created_at: string;
  updated_at: string;
  expires_at: string;
  last_refresh: string;
  refresh_count: number;
  enabled: boolean;
}

// RPC Function Response Types
export interface DeviceSubscriptionResponse {
  fcm_token: string | null;
  enabled: boolean;
}

export interface DeviceTokenResponse {
  device_id: string;
  device_type: 'web' | 'android' | 'ios';
  enabled: boolean;
}

export interface ContactProcessingLog {
  id: string;
  contact_id: string;
  processing_date: string;
  batch_id: string | null;
  status: 'pending' | 'success' | 'error' | 'max_retries_exceeded';
  error_message: string | null;
  retry_count: number;
  last_error: string | null;
  created_at: string;
}

export interface ContentReport {
  id: string;
  user_id: string;
  contact_id: string;
  content: string;
  created_at: string;
}

export interface PromptGenerationLog {
  id: string;
  user_id: string;
  prompt_text: string;
  theme: string;
  subtheme: string;
  perspective: string;
  emotional_modifier: string;
  created_at: string;
}

export interface Database {
  public: {
    Tables: {
      contacts: {
        Row: Contact;
        Insert: Omit<Contact, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Contact, 'id' | 'created_at' | 'updated_at'>>;
      };
      important_events: {
        Row: ImportantEvent;
        Insert: Omit<ImportantEvent, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<ImportantEvent, 'id' | 'created_at' | 'updated_at'>>;
      };
      interactions: {
        Row: Interaction;
        Insert: Omit<Interaction, 'id' | 'created_at'>;
        Update: Partial<Omit<Interaction, 'id' | 'created_at'>>;
      };
      reminders: {
        Row: Reminder;
        Insert: Omit<Reminder, 'id' | 'created_at'>;
        Update: Partial<Omit<Reminder, 'id' | 'created_at'>>;
      };
      user_preferences: {
        Row: UserPreferences;
        Insert: Omit<UserPreferences, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<UserPreferences, 'id' | 'created_at' | 'updated_at'>>;
      };
      push_subscriptions: {
        Row: PushSubscription;
        Insert: Omit<PushSubscription, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<PushSubscription, 'id' | 'created_at' | 'updated_at'>>;
      };
      contact_processing_logs: {
        Row: ContactProcessingLog;
        Insert: Omit<ContactProcessingLog, 'id' | 'created_at'>;
        Update: Partial<Omit<ContactProcessingLog, 'id' | 'created_at'>>;
      };
      content_reports: {
        Row: ContentReport;
        Insert: Omit<ContentReport, 'id' | 'created_at'>;
        Update: Partial<Omit<ContentReport, 'id' | 'created_at'>>;
      };
      prompt_generation_logs: {
        Row: PromptGenerationLog;
        Insert: Omit<PromptGenerationLog, 'id' | 'created_at'>;
        Update: Partial<Omit<PromptGenerationLog, 'id' | 'created_at'>>;
      };
    };
  };
}