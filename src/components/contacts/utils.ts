/**
 * Validates a phone number against common formats
 * Accepts formats: +1234567890, 123-456-7890, (123) 456-7890, 1234567890
 * @param phone - The phone number to validate
 * @returns boolean indicating if the phone number is valid
 */
export const isValidPhoneNumber = (phone: string): boolean => {
  // Matches formats: +1234567890, 123-456-7890, (123) 456-7890, 1234567890
  const phoneRegex = /^(\+\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}$/;
  return phoneRegex.test(phone.trim());
};

/**
 * Validates a social media handle
 * Must either be empty or start with @
 * @param handle - The social media handle to validate
 * @returns boolean indicating if the handle is valid
 */
export const isValidSocialHandle = (handle: string): boolean => {
  return handle === '' || handle.startsWith('@');
};

/**
 * Formats a Date object to local datetime string suitable for datetime-local input
 * Removes seconds and timezone information
 * @param date - The date to format
 * @returns Formatted date string in YYYY-MM-DDThh:mm format
 */
export const formatLocalDateTime = (date: Date): string => {
  return date.toISOString().slice(0, -8); // Remove seconds and timezone
};

/**
 * Validates an important event date to ensure it's not in the past
 * @param date - The date to validate
 * @returns boolean indicating if the date is valid
 */
export const isValidEventDate = (date: string): boolean => {
  const eventDate = new Date(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Reset time to start of day for comparison
  return eventDate >= today;
};

/**
 * Validates an important event name for custom events
 * @param name - The name to validate
 * @returns boolean indicating if the name is valid
 */
export const isValidEventName = (name: string | null): boolean => {
  return name !== null && name.trim().length > 0 && name.trim().length <= 100;
};

/**
 * Initial state for a new contact form
 * Sets default values for all required fields
 */
export const initialFormData = {
  name: '',
  phone: '',
  social_media_handle: '',
  preferred_contact_method: null,
  notes: '',
  relationship_level: 3,
  contact_frequency: null,
  user_id: '',
  last_contacted: formatLocalDateTime(new Date()),
  next_contact_due: null,
  ai_last_suggestion: null,
  ai_last_suggestion_date: null,
  missed_interactions: 0,
  important_events: [] // Initialize with empty array
};

/**
 * Initial state for form validation errors
 */
export const initialErrors = {
  name: '',
  phone: '',
  social_media_handle: '',
  important_events: [] // Array of error messages for each event
};

/**
 * Format a date for display in the UI
 * @param date - ISO date string
 * @returns Formatted date string (e.g., "March 15, 2025")
 */
export const formatEventDate = (date: string): string => {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

/**
 * Get event type display name
 * @param type - Event type ('birthday', 'anniversary', 'custom')
 * @returns Display name for the event type
 */
export const getEventTypeDisplay = (type: string): string => {
  const typeMap: Record<string, string> = {
    birthday: 'Birthday',
    anniversary: 'Anniversary',
    custom: 'Custom Event'
  };
  return typeMap[type] || type;
};