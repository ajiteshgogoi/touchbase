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
 * Check if an event is upcoming within the next specified days
 * Uses dayjs for consistent date handling across timezones
 * @param eventDate - The event date string
 * @param daysThreshold - Number of days to look ahead (default 7)
 * @returns boolean indicating if the event is upcoming
 */
export const isUpcomingEvent = (eventDate: string, daysThreshold: number = 7): boolean => {
  const today = dayjs().startOf('day');
  // Parse the date and ensure we're only using date component by using startOf('day')
  let event = dayjs.utc(eventDate).startOf('day');
  
  // Set event to this year, maintaining the month and day
  event = event.year(today.year());
  
  // If event already passed this year, check next year's date
  if (event.isBefore(today)) {
    event = event.add(1, 'year');
  }
  
  const diffDays = event.diff(today, 'day');
  return diffDays >= 0 && diffDays <= daysThreshold;
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