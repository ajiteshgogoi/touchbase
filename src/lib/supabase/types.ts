/** Custom type for timestamp fields */
export type Timestamp = string;

/**
 * Note: Database UUIDs are represented as strings in TypeScript 
 * This is because UUIDs are converted to strings when transported over JSON
 * and are typically handled as strings in frontend code.
 */
export type UUID = string;

/** Notification status enum type as defined in schema */
export type NotificationStatus = 'success' | 'error' | 'invalid_token';

/** Basic contact information */
export interface BasicContact {
  id: string;
  name: string;
  last_contacted: Timestamp | null;
  next_contact_due: Timestamp | null;
  contact_frequency: 'every_three_days' | 'weekly' | 'fortnightly' | 'monthly' | 'quarterly';
  missed_interactions: number;
  preferred_contact_method: 'call' | 'message' | 'social' | null;
}

/** Full contact information */
export interface Contact extends BasicContact {
  user_id: string;
  phone: string | null;
  social_media_platform: 'linkedin' | 'instagram' | 'twitter' | null;
  social_media_handle: string | null;
  notes: string | null;
  ai_last_suggestion: string | null;
  ai_last_suggestion_date: Timestamp | null;
  created_at: Timestamp;
  updated_at: Timestamp;
}

/** Important events for tracking birthdays, anniversaries, and custom events */
export interface ImportantEvent {
  id: string;
  contact_id: string;
  user_id: string;
  type: 'birthday' | 'anniversary' | 'custom';
  name: string | null; // Required for custom events, optional for birthday/anniversary
  date: Timestamp;
  next_occurrence?: Timestamp; // Added for optimized event queries
  created_at: Timestamp;
  updated_at: Timestamp;
}

/** Interaction records */
export interface Interaction {
  id: string;
  user_id: string;
  contact_id: string;
  type: 'call' | 'message' | 'social' | 'meeting';
  date: Timestamp;
  notes: string | null;
  sentiment: 'positive' | 'neutral' | 'negative' | null;
  created_at: Timestamp;
}

/** Reminder information */
export interface Reminder {
  id: string;
  contact_id: string;
  user_id: string;
  type: 'call' | 'message' | 'social';
  name: string | null;  // Optional name for quick reminders
  due_date: Timestamp;
  completed: boolean;
  created_at: Timestamp;
}

/** Reminder with contact information */
export interface ReminderWithContact extends Reminder {
  contact: {
    name: string;
  };
}

/** Quick reminder input type */
export interface QuickReminderInput {
  contact_id: string;
  name: string;
  due_date: Timestamp;
  type: 'call' | 'message' | 'social';
  is_important?: boolean;
}

/** User preferences */
export interface UserPreferences {
  id: string;
  user_id: string;
  notification_enabled: boolean;
  theme: 'light' | 'dark' | 'system';
  timezone: string;
  ai_suggestions_enabled: boolean;
  has_rated_app: boolean;
  last_rating_prompt: Timestamp | null;
  install_time: Timestamp;
  onboarding_completed: boolean;
  created_at: Timestamp;
  updated_at: Timestamp;
}

/** Push subscription information */
export interface PushSubscription {
  id: string;
  user_id: string;
  fcm_token: string;
  device_id: string;
  device_name: string | null;
  device_type: 'web' | 'android' | 'ios';
  browser_instance: string;
  created_at: Timestamp;
  updated_at: Timestamp;
  expires_at: Timestamp;
  last_refresh: Timestamp;
  refresh_count: number;
  enabled: boolean;
}

/** Device subscription response */
export interface DeviceSubscriptionResponse {
  fcm_token: string | null;
  enabled: boolean;
}

/** Device token response */
export interface DeviceTokenResponse {
  device_id: string;
  device_type: 'web' | 'android' | 'ios';
  enabled: boolean;
}

/** Contact processing log */
export interface ContactProcessingLog {
  id: string;
  contact_id: string;
  processing_date: Timestamp;
  batch_id: string | null;
  status: 'pending' | 'success' | 'error' | 'max_retries_exceeded';
  error_message: string | null;
  retry_count: number;
  last_error: string | null;
  created_at: Timestamp;
}

/** Content report information */
export interface ContentReport {
  id: string;
  user_id: string;
  contact_id: string;
  content: string;
  content_type: 'suggestion' | 'conversation-prompt';
  created_at: Timestamp;
}

/** Prompt generation log */
export interface PromptGenerationLog {
  id: string;
  user_id: string;
  prompt_text: string;
  theme: string;
  subtheme: string;
  perspective: string;
  emotional_modifier: string;
  created_at: Timestamp;
}

/** User feedback */
export interface Feedback {
  id: string;
  user_id: string;
  email: string;
  feedback: string;
  type: 'general' | 'cancellation';
  reason: string | null;
  created_at: Timestamp;
}

/** Subscription information */
export interface Subscription {
  id: string;
  user_id: string;
  plan_id: 'free' | 'premium';
  status: 'active' | 'canceled' | 'expired';
  paypal_subscription_id: string | null;
  google_play_token: string | null;
  valid_until: Timestamp;
  trial_start_date: Timestamp | null;
  trial_end_date: Timestamp | null;
  created_at: Timestamp;
  updated_at: Timestamp;
}

/** Notification history */
export interface NotificationHistory {
  id: string;
  user_id: string;
  notification_type: 'morning' | 'afternoon' | 'evening';
  sent_at: Timestamp;
  status: NotificationStatus;
  error_message: string | null;
  batch_id: string | null;
  retry_count: number;
  created_at: Timestamp;
}

/** Contact analytics data */
export interface ContactAnalytics {
  id: string;
  user_id: string;
  data: {
    contactCount: number;
    interactionStats: {
      total: number;
      byType: Record<string, number>;
      byMonth: Record<string, number>;
    };
    contactFrequencyDistribution: Record<string, number>;
    missedInteractions: number;
    upcomingEvents: number;
  };
  generated_at: Timestamp;
  created_at: Timestamp;
}

/** Database schema type definitions */
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
      feedback: {
        Row: Feedback;
        Insert: Omit<Feedback, 'id' | 'created_at'>;
        Update: Partial<Omit<Feedback, 'id' | 'created_at'>>;
      };
      subscriptions: {
        Row: Subscription;
        Insert: Omit<Subscription, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Subscription, 'id' | 'created_at' | 'updated_at'>>;
      };
      notification_history: {
        Row: NotificationHistory;
        Insert: Omit<NotificationHistory, 'id' | 'created_at'>;
        Update: Partial<Omit<NotificationHistory, 'id' | 'created_at'>>;
      };
      contact_analytics: {
        Row: ContactAnalytics;
        Insert: Omit<ContactAnalytics, 'id' | 'created_at'>;
        Update: Partial<Omit<ContactAnalytics, 'id' | 'created_at'>>;
      };
    };
  };
}