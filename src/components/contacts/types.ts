import { Contact } from '../../lib/supabase/types';

/**
 * Represents the form data structure for creating or editing a contact
 * This interface includes all editable fields and matches the database schema
 */
export interface ContactFormData {
  /** Full name of the contact */
  name: string;
  /** Contact's phone number (optional) */
  phone: string;
  /** Social media handle, must start with @ (optional) */
  social_media_handle: string;
  /** Preferred method of communication */
  preferred_contact_method: 'call' | 'message' | 'social' | null;
  /** Personal notes about the contact */
  notes: string;
  /** Relationship closeness level (1-5) */
  relationship_level: number;
  /** How often to maintain contact */
  contact_frequency: 'daily' | 'weekly' | 'fortnightly' | 'monthly' | 'quarterly' | null;
  /** User ID who owns this contact */
  user_id: string;
  /** Last time contact was made (ISO format) */
  last_contacted: string | null;
  /** When next contact is due */
  next_contact_due: string | null;
  /** Last AI-generated conversation suggestion */
  ai_last_suggestion: string | null;
  /** When the last AI suggestion was generated */
  ai_last_suggestion_date: string | null;
  /** Number of times contact was due but not made */
  missed_interactions: number;
}

/**
 * Form validation error messages for user input fields
 */
export interface FormErrors {
  /** Name validation error message */
  name: string;
  /** Phone number validation error message */
  phone: string;
  /** Social media handle validation error message */
  social_media_handle: string;
}

/**
 * Props interface for contact form sub-components
 */
export interface ContactFormProps {
  /** Current form data state */
  formData: ContactFormData;
  /** Current validation errors */
  errors: FormErrors;
  /** Callback for updating form data */
  onChange: (updates: Partial<ContactFormData>) => void;
  /** Callback for updating error messages */
  onError: (updates: Partial<FormErrors>) => void;
}

/**
 * Type for contact mutation operations (create/update)
 * Excludes auto-generated fields from the Contact type
 */
export type ContactMutationData = Omit<Contact, 'id' | 'created_at' | 'updated_at'>;