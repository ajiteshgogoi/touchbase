import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';

// Enable UTC plugin for consistent date handling
dayjs.extend(utc);

/**
 * Validates a phone number against common formats
 * Accepts formats: +1234567890, 123-456-7890, (123) 456-7890, 1234567890
 * @param phone - The phone number to validate
 * @returns boolean indicating if the phone number is valid
 */
export const isValidPhoneNumber = (phone: string): boolean => {
  // Matches international phone numbers with flexible formats
  // Allows:
  // - Optional + and country code (1-4 digits)
  // - Numbers 7-15 digits long
  // - Optional separators (space, dot, hyphen)
  // - Optional parentheses for area codes
  const phoneRegex = /^(?:\+?\d{1,4}[-.\s]?)?\(?\d{1,4}\)?[-.\s]?\d{1,15}$/;
  return phoneRegex.test(phone.trim());
};

/**
 * Validates a social media handle
 * Must not be empty when platform is selected
 * @param handle - The social media handle to validate
 * @param platform - The selected social media platform
 * @returns boolean indicating if the handle is valid
 */
export const isValidSocialHandle = (handle: string, platform: string | null): boolean => {
  if (!platform) return true; // If no platform selected, any handle is valid
  if (!handle) return false; // If platform selected, handle is required
  return /^[a-zA-Z0-9._]+$/.test(handle); // Only allow letters, numbers, dots, and underscores
};

/**
 * Format social media handle into platform-specific URL
 * @param handle - The social media handle
 * @param platform - The social media platform
 * @returns The formatted URL for the platform
 */
export const formatSocialMediaUrl = (handle: string, platform: string | null): string => {
  if (!handle || !platform) return '';
  
  switch (platform) {
    case 'twitter':
      return `https://twitter.com/${handle}`;
    case 'instagram':
      return `https://instagram.com/${handle}`;
    case 'linkedin':
      return `https://linkedin.com/in/${handle}`;
    default:
      return '';
  }
};

/**
 * Formats a Date object to local datetime string suitable for datetime-local input
 * Removes seconds and timezone information
 * @param date - The date to format
 * @returns Formatted date string in YYYY-MM-DDThh:mm format
 */
export const formatLocalDateTime = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

/**
 * Validates an important event date
 * No date validation needed since events are recurring yearly
 * @param date - The date to validate
 * @returns Always returns true since all dates are valid for recurring events
 */
export const isValidEventDate = (_date: string): boolean => {
  return true; // All dates are valid since events are recurring yearly
};

/**
 * Validates an important event name for custom events
 * @param name - The name to validate
 * @returns boolean indicating if the name is valid
 */
export const isValidEventName = (name: string | null): boolean => {
  return name !== null && name.trim().length > 0 && name.trim().length <= 50;
};


/**
 * Get the next occurrence of an event
 * Uses dayjs for consistent date handling across timezones
 * @param eventDate - The event date string
 * @returns ISO date string for the next occurrence
 */
export const getNextOccurrence = (eventDate: string): string => {
  const today = dayjs().startOf('day');
  // Parse the date and ensure we're only using date component
  let event = dayjs.utc(eventDate).startOf('day');
  
  // Set event to this year, maintaining the month and day
  event = event.year(today.year());
  
  // If event already passed this year, use next year's date
  if (event.isBefore(today)) {
    event = event.add(1, 'year');
  }
  
  return event.format('YYYY-MM-DD');
};

/**
 * Format a date for display in the UI
 * Uses dayjs for consistent date handling across timezones
 * @param date - ISO date string
 * @returns Formatted date string (e.g., "March 15")
 */
export const formatEventDate = (date: string): string => {
  try {
    // For dates with timezone info, parse as UTC first
    if (date.includes('+') || date.includes('Z')) {
      const localDate = dayjs.utc(date).local();
      return localDate.format('MMMM D');
    }
    
    // For dates without timezone, parse directly
    return dayjs(date).format('MMMM D');
  } catch (error) {
    console.error('Error formatting event date:', error);
    return 'Invalid date';
  }
};


/**
 * Format a datetime-local input value to UTC ISO string for storage
 * Handles the timezone conversion properly
 *
 * @param localDate - Date string from datetime-local input (YYYY-MM-DDThh:mm)
 * @returns Date string in ISO format
 */
export const formatEventToUTC = (localDate: string): string => {
  // Create a dayjs object from the local input
  const localDayjs = dayjs(localDate);
  
  // Create UTC date with just the date components, standardize time to midnight
  const utcDate = dayjs.utc()
    .year(localDayjs.year())
    .month(localDayjs.month())
    .date(localDayjs.date())
    .hour(0)
    .minute(0)
    .second(0);
  
  // Return just the date portion
  return utcDate.format('YYYY-MM-DD');
};

/**
 * Format an ISO date string for date input
 * Converts UTC date to local date format required by date input
 * Uses dayjs for consistent cross-browser handling
 *
 * @param date - ISO date string in UTC or Date object
 * @returns Formatted date string in YYYY-MM-DD format (local date)
 */
export const formatEventForInput = (date: string | Date | null): string => {
  if (!date) {
    // If no date provided, return current local date
    return dayjs().format('YYYY-MM-DD');
  }
  
  // First, ensure we're working with a UTC date
  const utcDate = typeof date === 'string' ?
    // For string dates (from DB), they're already in UTC
    dayjs.utc(date) :
    // For Date objects, convert to UTC
    dayjs(date).utc();
    
  // Convert UTC to local date for display
  const localDate = utcDate.local();
  
  // Format for date input (YYYY-MM-DD)
  return localDate.format('YYYY-MM-DD');
};

/**
 * Format a stored date for display in the date input
 * Converts from UTC to local time
 *
 * @param storedDate - ISO date string from storage
 * @returns Date string in YYYY-MM-DD format for date input
 */
export const formatStoredEventForInput = (storedDate: string): string => {
  try {
    // For dates with timezone info, parse as UTC first
    if (storedDate.includes('+') || storedDate.includes('Z')) {
      return dayjs.utc(storedDate).local().format('YYYY-MM-DD');
    }
    
    // For dates without timezone, parse directly
    return dayjs(storedDate).format('YYYY-MM-DD');
  } catch (error) {
    // If there's any parsing error, return current date
    console.error('Error parsing stored date:', error);
    return dayjs().format('YYYY-MM-DD');
  }
};

/**
 * Initial state for a new contact form
 * Sets default values for all required fields
 */
export const initialFormData = {
  name: '',
  phone: '',
  social_media_platform: null,
  social_media_handle: '',
  preferred_contact_method: null,
  notes: '',
  contact_frequency: '' as any, // No default contact frequency
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
  important_events: [], // Array of error messages for each event
  frequency: '' // Error message for contact frequency
};

/**
 * Get event type display name
 * @param type - Event type ('birthday', 'anniversary', 'custom')
 * @returns Display name for the event type
 */
/**
 * Sort important events in the order: birthday -> anniversary -> custom
 * @param events - Array of important events to sort
 * @returns Sorted array of events
 */
export const sortEventsByType = (events: any[]): any[] => {
  const typeOrder: Record<string, number> = {
    birthday: 0,
    anniversary: 1,
    custom: 2
  };
  
  return [...events].sort((a, b) =>
    (typeOrder[a.type] ?? 3) - (typeOrder[b.type] ?? 3)
  );
};

export const getEventTypeDisplay = (type: string, customName?: string | null): string => {
  if (type === 'custom' && customName) {
    return customName;
  }
  return type === 'birthday' ? 'Birthday' : type === 'anniversary' ? 'Anniversary' : '';
};

/**
 * Extract hashtags from text
 * @param text - Text to extract hashtags from
 * @param maxTags - Optional maximum number of hashtags allowed (default: no limit)
 * @returns Array of unique hashtags (lowercase)
 */
export const extractHashtags = (text: string, maxTags?: number): string[] => {
  const matches = text.match(/#[a-zA-Z]\w*/g) || [];
  // Filter out hashtags that don't meet length requirements (2-15 characters, not counting #)
  const validTags = [...new Set(matches
    .filter(tag => tag.length >= 2 && tag.length <= 16) // Include # in length check
    .map(tag => tag.toLowerCase())
  )];
  
  // If maxTags is specified, limit the number of tags
  return maxTags ? validTags.slice(0, maxTags) : validTags;
};

/**
 * Check if text exceeds maximum number of hashtags
 * @param text - Text to check
 * @param maxTags - Maximum number of hashtags allowed
 * @returns boolean indicating if text exceeds max hashtags
 */
export const exceedsMaxHashtags = (text: string, maxTags: number): boolean => {
  const hashtags = extractHashtags(text);
  return hashtags.length > maxTags;
};

/**
 * Format hashtag for display (capitalize first letter)
 * @param hashtag - Hashtag to format (including # symbol)
 * @returns Formatted hashtag
 */
export const formatHashtagForDisplay = (hashtag: string): string => {
  if (!hashtag.startsWith('#')) return hashtag;
  const word = hashtag.slice(1); // Remove # symbol
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
};

/**
 * Get all unique hashtags from contacts
 * @param contacts - Array of contacts
 * @returns Array of unique hashtags
 */
export const getAllUniqueHashtags = (contacts: Array<{ notes: string }>): string[] => {
  const allTags = contacts.flatMap(contact => extractHashtags(contact.notes || ''));
  return [...new Set(allTags)];
};

/**
 * Filter hashtag suggestions based on input
 * @param input - Current input text
 * @param existingTags - Array of all existing hashtags
 * @returns Filtered hashtag suggestions
 */
export const filterHashtagSuggestions = (input: string, existingTags: string[]): string[] => {
  const lastWord = input.split(' ').pop() || '';
  if (!lastWord.startsWith('#')) return [];
  
  // Get the current partial hashtag without the # symbol
  const search = lastWord.slice(1).toLowerCase();
  
  // Extract already used hashtags from the current input
  const usedTags = extractHashtags(input);
  
  return existingTags.filter(tag => {
    const tagText = tag.slice(1).toLowerCase();
    return (
      // Only show tags that start with what user is typing
      tagText.startsWith(search) &&
      // Don't show the exact partial tag being typed
      tag.toLowerCase() !== lastWord.toLowerCase() &&
      // Don't show tags that are already used in the notes
      !usedTags.includes(tag.toLowerCase())
    );
  });
};