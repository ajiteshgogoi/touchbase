export interface Contact {
  id: string;
  user_id: string;
  name: string;
  email?: string;
  phone?: string;
  last_contacted: string | null;
  next_contact_due: string | null;
  preferred_contact_method: 'email' | 'phone' | 'social' | null;
  notes: string | null;
  relationship_level: number;
  created_at: string;
  updated_at: string;
}

export interface Interaction {
  id: string;
  contact_id: string;
  type: 'call' | 'message' | 'social' | 'meeting' | 'other';
  date: string;
  notes: string | null;
  sentiment: 'positive' | 'neutral' | 'negative' | null;
  created_at: string;
}

export interface Reminder {
  id: string;
  contact_id: string;
  due_date: string;
  type: 'message' | 'call' | 'meetup' | 'other';
  description: string | null;
  is_completed: boolean;
  created_at: string;
}

export interface UserPreferences {
  id: string;
  user_id: string;
  reminder_frequency: 'daily' | 'weekly' | 'monthly';
  notification_enabled: boolean;
  theme: 'light' | 'dark' | 'system';
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
    };
  };
}