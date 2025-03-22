import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { parse } from 'https://esm.sh/csv-parse/sync'
import dayjs from 'https://esm.sh/dayjs@1.11.7'
import { createResponse, handleOptions } from '../_shared/headers.ts'

type ContactFrequency = 'every_three_days' | 'weekly' | 'fortnightly' | 'monthly' | 'quarterly'

function calculateNextContactDate(
  frequency: ContactFrequency,
  missedCount: number = 0,
  baseDate: Date | null = null,
  timezone: string = 'UTC'
): Date {
  // Get current time in user's timezone
  const now = baseDate
    ? new Date(baseDate.toLocaleString('en-US', { timeZone: timezone }))
    : new Date(new Date().toLocaleString('en-US', { timeZone: timezone }));
  
  // Start with today's date in user's timezone
  const nextDate = new Date(now);
  // Set to 9 AM in user's timezone
  const [hours, , , ] = new Date(nextDate.toLocaleString('en-US', { timeZone: timezone, hour12: false })).toTimeString().split(':');
  nextDate.setHours(9 - (parseInt(hours) - nextDate.getHours()), 0, 0, 0);
  
  // Calculate base interval in days
  let intervalDays = 0;
  switch (frequency) {
    case 'every_three_days':
      intervalDays = 3;
      break;
    case 'weekly':
      intervalDays = 7;
      break;
    case 'fortnightly':
      intervalDays = 14;
      break;
    case 'monthly':
      // Use 30 days as an approximation for a month
      intervalDays = 30;
      break;
    case 'quarterly':
      // Use 90 days as an approximation for a quarter
      intervalDays = 90;
      break;
    default:
      intervalDays = 7; // Default to weekly if invalid frequency
  }
  
  // Exponential backoff for missed interactions
  const backoffFactor = Math.pow(1.5, Math.min(missedCount, 5));
  const adjustedInterval = Math.round(intervalDays * backoffFactor);
  
  // Add the adjusted interval to the next date
  nextDate.setDate(nextDate.getDate() + adjustedInterval);
  
  return nextDate;
}

interface Contact {
  name: string
  contact_frequency: string
  phone?: string
  social_media_platform?: string
  social_media_handle?: string
  preferred_contact_method: string
  notes?: string
  important_events: Array<{
    type: 'birthday' | 'anniversary' | 'custom'
    name?: string
    date: string
  }>
}

interface ValidationError {
  row: number
  errors: string[]
}

interface ImportResult {
  success: boolean
  message: string
  successCount: number
  failureCount: number
  errors: ValidationError[]
}

function validateContact(contact: any, rowIndex: number): { isValid: boolean; errors: string[] } {
  const errors: string[] = []

  // Required fields
  if (!contact.name?.trim()) {
    errors.push('Name is required')
  }
  if (!contact.contact_frequency) {
    errors.push('Contact frequency is required')
  }

  // Validate contact frequency
  const validFrequencies = ['every_three_days', 'weekly', 'fortnightly', 'monthly', 'quarterly']
  if (contact.contact_frequency && !validFrequencies.includes(contact.contact_frequency)) {
    errors.push(`Invalid contact frequency. Must be one of: ${validFrequencies.join(', ')}`)
  }

  // Validate phone number if provided
  if (contact.phone && !/^(?:\+?\d{1,4}[-.\s]?)?\(?\d{1,4}\)?(?:[-.\s]?\d{1,4}){0,4}$/.test(contact.phone)) {
    errors.push('Invalid phone number format. Must be a valid international phone number with optional country code')
  }

  // Validate social media fields
  const hasPlatform = Boolean(contact.social_media_platform)
  const hasHandle = Boolean(contact.social_media_handle)
  if ((hasPlatform && !hasHandle) || (!hasPlatform && hasHandle)) {
    errors.push('Both social media platform and handle must be provided if one is set')
  }
  
  // Validate social media platform
  const validPlatforms = ['linkedin', 'instagram', 'twitter']
  if (contact.social_media_platform && !validPlatforms.includes(contact.social_media_platform)) {
    errors.push(`Invalid social media platform. Must be one of: ${validPlatforms.join(', ')}`)
  }

  // Validate preferred contact method
  const validContactMethods = ['call', 'message', 'social']
  if (contact.preferred_contact_method && !validContactMethods.includes(contact.preferred_contact_method)) {
    errors.push(`Invalid preferred contact method. Must be one of: ${validContactMethods.join(', ')}`)
  }

  // Validate dates in important events
  for (let i = 1; i <= 3; i++) {
    const nameField = `custom_event_${i}_name`;
    const dateField = `custom_event_${i}_date`;
    
    if (contact[dateField] && !contact[nameField]) {
      errors.push(`Custom event name ${i} is required when date is provided`)
    }
  }

  // Check date formats
  const dateFields = [
    { field: 'birthday', value: contact.birthday },
    { field: 'anniversary', value: contact.anniversary },
    { field: 'custom_event_1_date', value: contact.custom_event_1_date },
    { field: 'custom_event_2_date', value: contact.custom_event_2_date },
    { field: 'custom_event_3_date', value: contact.custom_event_3_date }
  ]

  dateFields.forEach(({ field, value }) => {
    if (value && !isValidDate(value)) {
      errors.push(`Invalid date format for ${field}. Use YYYY-MM-DD`)
    }
  })

  return {
    isValid: errors.length === 0,
    errors
  }
}

function isValidDate(dateStr: string): boolean {
  const date = new Date(dateStr)
  return date instanceof Date && !isNaN(date.getTime())
}

// Remove checkDuplicateContacts as we'll use upsert instead

async function* parseCSVChunks(file: File, batchSize: number = 50): AsyncGenerator<any[]> {
  const decoder = new TextDecoder();
  const reader = file.stream().getReader();
  
  let buffer = '';
  let records = [];
  let headers: string[] | null = null;
  let headerLine = '';

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      
      buffer += decoder.decode(value, { stream: true });
      
      // Process complete lines
      while (buffer.includes('\n')) {
        const lineEnd = buffer.indexOf('\n');
        const line = buffer.slice(0, lineEnd).trim();
        buffer = buffer.slice(lineEnd + 1);

        if (!headers) {
          // Store header line to parse future rows
          headerLine = line;
          headers = line.split(',').map(h => h.trim());
          continue;
        }

        if (line) {
          // Parse CSV line into object using headers
          const values = line.split(',').map(v => v.trim());
          const record = {};
          headers.forEach((header, index) => {
            record[header] = values[index] || '';
          });
          records.push(record);

          // Yield batch when size threshold is reached
          if (records.length >= batchSize) {
            yield records;
            records = [];
          }
        }
      }
    }

    // Process any remaining buffer
    buffer += decoder.decode();
    if (buffer.trim() && headers) {
      const lines = buffer.trim().split('\n');
      for (const line of lines) {
        if (line.trim()) {
          const values = line.split(',').map(v => v.trim());
          const record = {};
          headers.forEach((header, index) => {
            record[header] = values[index] || '';
          });
          records.push(record);

          if (records.length >= batchSize) {
            yield records;
            records = [];
          }
        }
      }
    }

    // Yield any remaining records
    if (records.length > 0) {
      yield records;
    }
  } finally {
    reader.releaseLock();
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return handleOptions()
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: {
            Authorization: req.headers.get('Authorization') ?? ''
          }
        }
      }
    )

    // Get the session from the request
    const authorization = req.headers.get('Authorization')
    if (!authorization) {
      return createResponse(
        { error: 'No authorization header' },
        { status: 401 }
      )
    }

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(
      authorization.replace('Bearer ', '')
    )

    if (userError || !user) {
      return createResponse(
        { error: 'Invalid token' },
        { status: 401 }
      )
    }

    // Process upload in memory without storing the file
    const formData = await req.formData()
    const file = formData.get('file')
    if (!file || !(file instanceof File)) {
      return createResponse(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    try {
      const result: ImportResult = {
        success: true,
        message: 'Import completed',
        successCount: 0,
        failureCount: 0,
        errors: []
      }

      // Get user's timezone preference once
      const { data: userPref } = await supabaseClient
        .from('user_preferences')
        .select('timezone')
        .eq('user_id', user.id)
        .single();

      // Use UTC if no timezone preference is set
      const timezone = userPref?.timezone || 'UTC';
      const now = new Date(new Date().toLocaleString('en-US', { timeZone: timezone }));

      // Process CSV in chunks
      for await (const batch of parseCSVChunks(file)) {
        // Validate contacts in batch
        const validRecords = [];
        for (const [index, record] of batch.entries()) {
          const { isValid, errors } = validateContact(record, index);
          if (!isValid) {
            result.failureCount++;
            result.errors.push({
              row: result.successCount + result.failureCount,
              errors
            });
            continue;
          }
          validRecords.push(record);
        }

        if (validRecords.length === 0) continue;

        // Prepare data for bulk upsert
        const contactsToUpsert = validRecords.map(record => ({
          user_id: user.id,
          name: record.name.trim(),
          contact_frequency: record.contact_frequency,
          phone: record.phone || null,
          social_media_platform: record.social_media_platform || null,
          social_media_handle: record.social_media_handle || null,
          preferred_contact_method: record.preferred_contact_method || 'message',
          notes: record.notes || '',
          next_contact_due: now.toISOString(),
          last_contacted: now.toISOString(),
          missed_interactions: 0
        }));

        if (contactsToUpsert.length === 0) continue;

        // Bulk upsert contacts - use DO NOTHING on conflict since we want to preserve existing data
        const { data: newContacts, error: insertError } = await supabaseClient
          .from('contacts')
          .upsert(contactsToUpsert, {
            onConflict: 'user_id,name',
            ignoreDuplicates: true
          })
          .select();

        if (insertError || !newContacts) {
          result.failureCount += contactsToInsert.length;
          contactsToInsert.forEach(() => {
            result.errors.push({
              row: result.successCount + result.failureCount,
              errors: [`Failed to insert contact: ${insertError?.message || 'Unknown error'}`]
            });
          });
          continue;
        }

        // Process events and reminders in bulk
        const allEvents = [];
        const allReminders = [];
        const today = dayjs().startOf('day');

        newContacts.forEach(newContact => {
          const record = validRecords.find(r => r.name.trim() === newContact.name);
          if (!record) return;

          const events = [];
          let eventCount = 0;

          // Add birthday if provided
          if (record.birthday && eventCount < 5) {
            events.push({
              contact_id: newContact.id,
              user_id: user.id,
              type: 'birthday',
              date: new Date(new Date(record.birthday).toLocaleString('en-US', { timeZone: timezone })).toISOString()
            });
            eventCount++;
          }

          // Add anniversary if provided
          if (record.anniversary && eventCount < 5) {
            events.push({
              contact_id: newContact.id,
              user_id: user.id,
              type: 'anniversary',
              date: new Date(new Date(record.anniversary).toLocaleString('en-US', { timeZone: timezone })).toISOString()
            });
            eventCount++;
          }

          // Add custom events
          for (let i = 1; i <= 3 && eventCount < 5; i++) {
            const nameField = `custom_event_${i}_name`;
            const dateField = `custom_event_${i}_date`;
            
            if (record[nameField] && record[dateField]) {
              events.push({
                contact_id: newContact.id,
                user_id: user.id,
                type: 'custom',
                name: record[nameField],
                date: new Date(new Date(record[dateField]).toLocaleString('en-US', { timeZone: timezone })).toISOString()
              });
              eventCount++;
            }
          }

          if (events.length > 0) {
            allEvents.push(...events);

            // Calculate next due date considering events
            const regularDueDate = calculateNextContactDate(newContact.contact_frequency, 0, now, timezone);
            const nextImportantEvent = events
              .map(event => {
                // Convert event date to user's timezone
                let eventDate = dayjs(new Date(event.date).toLocaleString('en-US', { timeZone: timezone })).startOf('day');
                eventDate = eventDate.year(today.year());
                if (eventDate.isBefore(today)) {
                  eventDate = eventDate.add(1, 'year');
                }
                return eventDate.toDate();
              })
              .sort((a, b) => a.getTime() - b.getTime())[0];

            let nextDueDate = regularDueDate;
            if (nextImportantEvent) {
              if (dayjs(regularDueDate).isSame(today, 'day')) {
                nextDueDate = nextImportantEvent;
              } else if (!dayjs(nextImportantEvent).isSame(today, 'day') && nextImportantEvent < regularDueDate) {
                nextDueDate = nextImportantEvent;
              }
            }

            newContact.next_contact_due = nextDueDate.toISOString();

            allReminders.push({
              contact_id: newContact.id,
              user_id: user.id,
              type: newContact.preferred_contact_method || 'message',
              due_date: nextDueDate.toISOString(),
              completed: false
            });
          }
        });

        // Bulk update contacts with new due dates
        if (newContacts.length > 0) {
          const { error: updateError } = await supabaseClient
            .from('contacts')
            .upsert(newContacts);

          if (updateError) {
            console.error('Failed to update next contact due dates:', updateError);
          }
        }

        // Bulk insert events
        if (allEvents.length > 0) {
          const { error: eventsError } = await supabaseClient
            .from('important_events')
            .insert(allEvents);

          if (eventsError) {
            console.error('Failed to insert events:', eventsError);
          }
        }

        // Bulk insert reminders
        if (allReminders.length > 0) {
          const { error: remindersError } = await supabaseClient
            .from('reminders')
            .insert(allReminders);

          if (remindersError) {
            console.error('Failed to insert reminders:', remindersError);
          }
        }

        result.successCount += newContacts.length;
      }

      return createResponse(result)
    } catch (error) {
      console.error('Error processing bulk import:', error)
      
      return createResponse(
        {
          success: false,
          message: error.message,
          successCount: 0,
          failureCount: 0,
          errors: [{ row: 0, errors: [error.message] }]
        },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Error in serve handler:', error)
    return createResponse(
      {
        success: false,
        message: error.message,
        successCount: 0,
        failureCount: 0,
        errors: [{ row: 0, errors: [error.message] }]
      },
      { status: 500 }
    )
  }
})