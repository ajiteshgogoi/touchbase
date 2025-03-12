import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { parse } from 'https://esm.sh/csv-parse/sync'
import dayjs from 'https://esm.sh/dayjs@1.11.7'
import { createResponse, handleOptions } from '../_shared/headers.ts'

type ContactFrequency = 'every_three_days' | 'weekly' | 'fortnightly' | 'monthly' | 'quarterly'

function calculateNextContactDate(
  frequency: ContactFrequency,
  missedCount: number = 0,
  baseDate: Date | null = null
): Date {
  const now = baseDate ? new Date(baseDate) : new Date();
  
  // Start with today's date
  const nextDate = new Date(now);
  nextDate.setHours(9, 0, 0, 0); // Set to 9 AM
  
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
  if (contact.phone && !/^(?:\+?\d{1,4}[-.\s]?)?\(?\d{1,4}\)?[-.\s]?\d{1,15}$/.test(contact.phone)) {
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

async function checkDuplicateContact(name: string, supabase: any, userId: string): Promise<boolean> {
  const { data: duplicates } = await supabase
    .from('contacts')
    .select('id')
    .eq('user_id', userId)
    .ilike('name', name)
    .limit(1)

  return duplicates?.length > 0
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
      // Read and parse CSV in memory
      const csvContent = await file.text()
      const records = parse(csvContent, {
        columns: true,
        skip_empty_lines: true
      })

      // Clear file data from memory
      formData.delete('file')

      const result: ImportResult = {
        success: true,
        message: 'Import completed',
        successCount: 0,
        failureCount: 0,
        errors: []
      }

      // Process records in batches
      const batchSize = 50
      const batches = []
      for (let i = 0; i < records.length; i += batchSize) {
        batches.push(records.slice(i, i + batchSize))
      }

      for (const batch of batches) {
        const validContacts = []
        
        // Validate each contact in the batch
        for (const [index, record] of batch.entries()) {
          const { isValid, errors } = validateContact(record, index)
          
          if (!isValid) {
            result.failureCount++
            result.errors.push({
              row: index + 1,
              errors
            })
            continue
          }

          // Check for duplicates
          const isDuplicate = await checkDuplicateContact(record.name, supabaseClient, user.id)
          if (isDuplicate) {
            result.failureCount++
            result.errors.push({
              row: index + 1,
              errors: [`Contact with name '${record.name}' already exists`]
            })
            continue
          }

          // Prepare contact data
          const contactData = {
            user_id: user.id,
            name: record.name.trim(),
            contact_frequency: record.contact_frequency,
            phone: record.phone || null,
            social_media_platform: record.social_media_platform || null,
            social_media_handle: record.social_media_handle || null,
            preferred_contact_method: record.preferred_contact_method || 'message',
            notes: record.notes || ''
          }

          validContacts.push(contactData)
        }

        // Insert valid contacts and their events
        if (validContacts.length > 0) {
          for (const contact of validContacts) {
            // Get user's timezone preference
            const { data: userPref } = await supabaseClient
              .from('user_preferences')
              .select('timezone')
              .eq('user_id', contact.user_id)
              .single();

            // Use UTC if no timezone preference is set
            const timezone = userPref?.timezone || 'UTC';
            
            // Get current time in user's timezone
            const now = new Date(new Date().toLocaleString('en-US', { timeZone: timezone }));

            // Insert contact with initial dates
            const { data: insertedContact, error: insertError } = await supabaseClient
              .from('contacts')
              .insert({
                ...contact,
                next_contact_due: now.toISOString(),
                last_contacted: now.toISOString(),
                missed_interactions: 0
              })
              .select()
              .single()

            if (insertError) {
              throw new Error(`Failed to insert contact: ${insertError.message}`)
            }

            // Process important events (max 5 per contact)
            const record = batch.find(r => r.name === contact.name)
            if (record) {
              const events = []
              let eventCount = 0;

              // Add birthday if provided
              if (record.birthday && eventCount < 5) {
                events.push({
                  contact_id: insertedContact.id,
                  user_id: user.id,
                  type: 'birthday',
                  date: new Date(record.birthday).toISOString()
                })
                eventCount++;
              }

              // Add anniversary if provided
              if (record.anniversary && eventCount < 5) {
                events.push({
                  contact_id: insertedContact.id,
                  user_id: user.id,
                  type: 'anniversary',
                  date: new Date(record.anniversary).toISOString()
                })
                eventCount++;
              }

              // Add custom events if provided (up to 3)
              for (let i = 1; i <= 3; i++) {
                const nameField = `custom_event_${i}_name`;
                const dateField = `custom_event_${i}_date`;
                
                if (record[nameField] && record[dateField] && eventCount < 5) {
                  events.push({
                    contact_id: insertedContact.id,
                    user_id: user.id,
                    type: 'custom',
                    name: record[nameField],
                    date: new Date(record[dateField]).toISOString()
                  });
                  eventCount++;
                }
              }

              // Insert events if any
              if (events.length > 0) {
                const { error: eventsError } = await supabaseClient
                  .from('important_events')
                  .insert(events)

                if (eventsError) {
                  throw new Error(`Failed to insert important events: ${eventsError.message}`)
                }
              }
              
              // Calculate regular next due date
              const regularDueDate = calculateNextContactDate(
                contact.contact_frequency,
                0, // No missed interactions for new contacts
                now
              );

              // Find next important event date
              const today = dayjs().startOf('day');
              const nextImportantEvent = events
                .map(event => {
                  let eventDate = dayjs(event.date).startOf('day');
                  eventDate = eventDate.year(today.year());
                  if (eventDate.isBefore(today)) {
                    eventDate = eventDate.add(1, 'year');
                  }
                  return eventDate.toDate();
                })
                .sort((a, b) => a.getTime() - b.getTime())[0];

              // Determine which date to use
              let nextDueDate = regularDueDate;
              if (nextImportantEvent) {
                if (dayjs(regularDueDate).isSame(today, 'day')) {
                  nextDueDate = nextImportantEvent;
                } else if (!dayjs(nextImportantEvent).isSame(today, 'day') && nextImportantEvent < regularDueDate) {
                  nextDueDate = nextImportantEvent;
                }
              }

              // Update contact with final next_contact_due date
              const { error: updateError } = await supabaseClient
                .from('contacts')
                .update({ next_contact_due: nextDueDate.toISOString() })
                .eq('id', insertedContact.id);

              if (updateError) {
                throw new Error(`Failed to update next contact due: ${updateError.message}`)
              }

              // Create reminder with calculated date
              const { error: reminderError } = await supabaseClient
                .from('reminders')
                .insert({
                  contact_id: insertedContact.id,
                  user_id: contact.user_id,
                  type: contact.preferred_contact_method || 'message',
                  due_date: nextDueDate.toISOString(),
                  completed: false
                });

              if (reminderError) {
                throw new Error(`Failed to create reminder: ${reminderError.message}`)
              }
            }

            result.successCount++
          }
        }
      }

      // Clear CSV data from memory after processing
      records.length = 0

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