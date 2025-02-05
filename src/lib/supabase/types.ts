export interface Contact {
  id: string;
  user_id: string;
  name: string;
  phone?: string;
  social_media_handle?: string;
  last_contacted: string | null;
  next_contact_due: string | null;
  preferred_contact_method: 'call' | 'message' | 'social' | null;
  notes: string | null;
  relationship_level: number;
  contact_frequency: 'daily' | 'weekly' | 'fortnightly' | 'monthly' | 'quarterly' | null;
  ai_last_suggestion: string | null;
  ai_last_suggestion_date: string | null;
  missed_interactions: number;
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
  due_date: string;
  type: 'call' | 'message' | 'social';
  description: string | null;
  created_at: string;
}

export interface UserPreferences {
  id: string;
  user_id: string;
  notification_enabled: boolean;
  theme: 'light' | 'dark' | 'system';
  timezone: string;
  created_at: string;
  updated_at: string;
}

export interface PushSubscription {
  id: string;
  user_id: string;
  fcm_token: string;
  created_at: string;
  updated_at: string;
}

export interface Database {
  public: {
    Tables: {
      contacts: {
        Row: Contact;
        Insert: Omit<Contact, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Contact, 'id' | 'created_at' | 'updated_at'>>;
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
    };
  };
}