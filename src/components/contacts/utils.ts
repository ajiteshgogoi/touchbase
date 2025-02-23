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
  return name !== null && name.trim().length > 0 && name.trim().length <= 100;
};

/**
 * Formats a date to ISO string for form submission
 * Standardizes the time to noon UTC to avoid timezone issues
 * @param date - The date string from the form input
 * @returns ISO date string with standardized time
 */
export const formatEventInputToISO = (dateStr: string): string => {
  // Parse the local datetime input value to a Date object
  const localDate = new Date(dateStr);
  
  // Get the local hours and minutes from input
  const hours = localDate.getHours();
  const minutes = localDate.getMinutes();
  
  // Create UTC date preserving the local time
  return dayjs.utc()
    .year(localDate.getFullYear())
    .month(localDate.getMonth())
    .date(localDate.getDate())
    .hour(hours)
    .minute(minutes)
    .second(0)
    .toISOString();
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
  let event = dayjs.utc(eventDate);
  
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
  let event = dayjs.utc(eventDate);
  
  // Set event to this year, maintaining the month and day
  event = event.year(today.year());
  
  // If event already passed this year, use next year's date
  if (event.isBefore(today)) {
    event = event.add(1, 'year');
  }
  
  return event.toISOString();
};

/**
 * Format a date for display in the UI
 * Uses dayjs for consistent date handling across timezones
 * @param date - ISO date string
 * @returns Formatted date string (e.g., "March 15")
 */
export const formatEventDate = (date: string): string => {
  return dayjs.utc(date).format('MMMM D');
};

/**
 * Format an ISO date string for datetime-local input
 * Converts UTC date to local datetime format required by datetime-local input
 * Uses dayjs for consistent cross-browser handling
 *
 * @param date - ISO date string in UTC
 * @returns Formatted date string in YYYY-MM-DDThh:mm format (local time)
 */
export const formatEventForInput = (date: string): string => {
  // Parse the UTC date and convert to local time
  const localDate = dayjs.utc(date).local();
  // Return in format required by datetime-local input (YYYY-MM-DDThh:mm)
  return localDate.format('YYYY-MM-DD[T]HH:mm');
};

/**
 * Format a datetime-local input value to UTC ISO string for storage
 * Handles the timezone conversion properly by:
 * 1. Parsing the input as local time (since datetime-local provides local time)
 * 2. Converting to UTC for storage
 * 3. Formatting without timezone suffix to work with datetime-local input
 *
 * @param localDate - Date string from datetime-local input (YYYY-MM-DDThh:mm)
 * @returns Date string in YYYY-MM-DDThh:mm format (UTC)
 */
export const formatEventToUTC = (localDate: string): string => {
  // Parse the local input as-is (datetime-local input is always in local time)
  const parsed = dayjs(localDate);
  // Convert to UTC and format in the required format without timezone suffix
  return parsed.utc().format('YYYY-MM-DD[T]HH:mm');
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