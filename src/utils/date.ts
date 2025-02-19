import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';

// Initialize dayjs plugins
dayjs.extend(utc);
dayjs.extend(timezone);

export type ContactFrequency = 'daily' | 'weekly' | 'fortnightly' | 'monthly' | 'quarterly' | null;
export type RelationshipLevel = 1 | 2 | 3 | 4 | 5;

// Format date with timezone
export function formatDateWithTimezone(
  date: string | Date | null | undefined,
  timezone: string,
  format: string = 'MMMM D, YYYY'
): string {
  if (!date) return '';
  return dayjs(date).tz(timezone).format(format);
}

// Convert a date to user's timezone and normalize to start of day
export function normalizeToUserTimezone(date: Date, timezone: string = 'UTC'): Date {
  // Convert to user's timezone
  const userDate = new Date(date.toLocaleString('en-US', { timeZone: timezone }));
  // Normalize to start of day
  userDate.setHours(0, 0, 0, 0);
  return userDate;
}

// Get the current time in user's timezone
export function getCurrentTimeInTimezone(timezone: string = 'UTC'): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: timezone }));
}

// Calculate next contact date based on unified formula
export function calculateNextContactDate(
  level: RelationshipLevel,
  frequency: ContactFrequency,
  missedInteractions: number = 0,
  baseDate?: Date | null,
  timezone: string = 'UTC'
): Date {
  // Use provided base date or current date in user's timezone
  const referenceDate = baseDate ? 
    normalizeToUserTimezone(baseDate, timezone) : 
    normalizeToUserTimezone(getCurrentTimeInTimezone(timezone));

  // Base intervals in days
  const baseIntervals: Record<RelationshipLevel, number> = {
    1: 90,  // Acquaintance: ~3 months
    2: 60,  // Casual friend: ~2 months
    3: 30,  // Friend: ~1 month
    4: 14,  // Close friend: ~2 weeks
    5: 7    // Very close: ~1 week
  };

  // Frequency intervals in days
  const frequencyMap: Record<NonNullable<ContactFrequency>, number> = {
    daily: 1,
    weekly: 7,
    fortnightly: 14,
    monthly: 30,
    quarterly: 90
  };

  // Get base interval from relationship level
  let days = baseIntervals[level];

  // Adjust based on specified frequency if provided
  if (frequency) {
    // Use the more frequent of the two options
    days = Math.min(days, frequencyMap[frequency]);
  }

  // Unified formula for missed interactions
  if (missedInteractions > 0) {
    // Use exponential backoff but ensure minimum 1 day
    const urgencyMultiplier = Math.max(0.3, 1 - missedInteractions * 0.2);
    days = Math.max(1, Math.round(days * urgencyMultiplier));
  }

  // Calculate next date from reference
  const nextDate = new Date(referenceDate);
  nextDate.setDate(nextDate.getDate() + days);

  // If calculated date would be in the past, use current date as base
  const now = normalizeToUserTimezone(getCurrentTimeInTimezone(timezone));
  if (nextDate <= now) {
    nextDate.setTime(now.getTime());
    nextDate.setDate(nextDate.getDate() + days);
  }

  return nextDate;
}

// Check if a date is today in user's timezone
export function isToday(date: Date, timezone: string = 'UTC'): boolean {
  const userDate = normalizeToUserTimezone(date, timezone);
  const userNow = normalizeToUserTimezone(getCurrentTimeInTimezone(timezone));
  return userDate.getTime() === userNow.getTime();
}

// Check if a date is before today in user's timezone
export function isBeforeToday(date: Date, timezone: string = 'UTC'): boolean {
  const userDate = normalizeToUserTimezone(date, timezone);
  const userNow = normalizeToUserTimezone(getCurrentTimeInTimezone(timezone));
  return userDate < userNow;
}

// Check if current time is end of day (23:59) in user's timezone
export function isEndOfDay(timezone: string = 'UTC'): boolean {
  const userNow = getCurrentTimeInTimezone(timezone);
  return userNow.getHours() >= 23 && userNow.getMinutes() >= 59;
}