import { Contact, ImportantEvent } from '../../lib/supabase/types';

/**
 * Represents a single important event in the form
 */
export interface ImportantEventFormData {
  id?: string; // Only present for existing events
  type: 'birthday' | 'anniversary' | 'custom';
  name: string | null;
  date: string;
}

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
  /** How often to maintain contact */
  contact_frequency: 'every_three_days' | 'weekly' | 'fortnightly' | 'monthly' | 'quarterly';
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
  /** Important events for this contact */
  important_events: ImportantEventFormData[];
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
  /** Important events validation error messages */
  important_events: string[];
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
  /** Optional prop to indicate if the component should be in edit mode */
  isEditMode?: boolean;
}

/**
 * Type for contact mutation operations (create/update)
 * Excludes auto-generated fields from the Contact type
 */
export type ContactMutationData = Omit<Contact, 'id' | 'created_at' | 'updated_at'>;

/**
 * Type for important event mutation operations (create/update)
 * Excludes auto-generated fields from the ImportantEvent type
 */
export type ImportantEventMutationData = Omit<ImportantEvent, 'id' | 'created_at' | 'updated_at'>;