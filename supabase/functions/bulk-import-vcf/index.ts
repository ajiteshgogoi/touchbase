import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { createResponse, handleOptions } from '../_shared/headers.ts'
import dayjs from 'https://esm.sh/dayjs@1.11.7'

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
  phone?: string
  social_media_platform?: string
  social_media_handle?: string
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

function validateSocialMediaPlatform(platform: string): string | null {
  const validPlatforms = ['linkedin', 'instagram', 'twitter'];
  const normalized = platform.toLowerCase();
  return validPlatforms.includes(normalized) ? normalized : null;
}

function processVCardLine(line: string, contact: Contact, timezone: string): void {
  if (line.startsWith('FN:')) {
    contact.name = line.substring(3).trim();
  } else if (line.startsWith('TEL')) {
    // Get the full line for type checking
    const telLine = line.toLowerCase();
    const number = line.substring(line.indexOf(':') + 1).trim();
  
    // Skip empty numbers
    if (!number) return;
  
    // Priority order:
    // 1. Mobile/Cell
    // 2. Main/Primary
    // 3. Home
    // 4. Work
    // 5. Other (first encountered)
    
    // If no phone set yet, set it (covers case 5)
    if (!contact.phone) {
      contact.phone = number;
    }
  
    // Check for specific types and override based on priority
    if (telLine.includes('cell') || telLine.includes('mobile')) {
      contact.phone = number; // Mobile takes highest priority
    } else if (!contact.phone || telLine.includes('main') || telLine.includes('pref')) {
      contact.phone = number; // Main/Primary takes second priority
    } else if (!contact.phone || telLine.includes('home')) {
      contact.phone = number; // Home takes third priority
    } else if (!contact.phone || telLine.includes('work')) {
      contact.phone = number; // Work takes fourth priority
    }
  } else if (line.startsWith('X-SOCIALPROFILE;') || line.startsWith('SOCIALPROFILE;')) {
    const match = line.match(/TYPE=(\w+):(.+)/i);
    if (match) {
      const platform = validateSocialMediaPlatform(match[1]);
      const handle = match[2].trim();
      if (platform) {
        contact.social_media_platform = platform;
        contact.social_media_handle = handle;
      }
    }
  } else if (line.startsWith('BDAY:')) {
    // Extract birthday in format YYYY-MM-DD
    const date = line.substring(5).trim();
    if (date && contact.important_events.length < 5) {
      try {
        // Parse and validate date
        const parsedDate = new Date(date);
        if (!isNaN(parsedDate.getTime()) &&
            !contact.important_events.some(event => event.type === 'birthday')) {
          // Convert to user's timezone and set to midnight
          const userDate = new Date(parsedDate.toLocaleString('en-US', { timeZone: timezone }));
          userDate.setHours(0, 0, 0, 0);
          contact.important_events.push({
            type: 'birthday',
            date: userDate.toISOString()
          });
        }
      } catch (e) {
        console.error('Invalid birthday date:', date);
      }
    }
  } else if (line.startsWith('ANNIVERSARY:') || line.startsWith('X-ANNIVERSARY:')) {
    // Extract anniversary date
    const date = line.includes('X-ANNIVERSARY:') ?
      line.substring(13).trim() :
      line.substring(12).trim();
    if (date && contact.important_events.length < 5) {
      try {
        // Parse and validate date
        const parsedDate = new Date(date);
        if (!isNaN(parsedDate.getTime()) &&
            !contact.important_events.some(event => event.type === 'anniversary')) {
          // Convert to user's timezone and set to midnight
          const userDate = new Date(parsedDate.toLocaleString('en-US', { timeZone: timezone }));
          userDate.setHours(0, 0, 0, 0);
          contact.important_events.push({
            type: 'anniversary',
            date: userDate.toISOString()
          });
        }
      } catch (e) {
        console.error('Invalid anniversary date:', date);
      }
    }
  } else if (line.startsWith('X-EVENT:') || line.startsWith('CATEGORIES:')) {
    // Extract custom events (some VCF files use CATEGORIES for events)
    const eventData = line.includes('X-EVENT:') ?
      line.substring(8).trim() :
      line.substring(11).trim();
    
    const [name, date] = eventData.split(';').map(s => s.trim());
    // Only add custom event if it has a name and we're under the limit
    if (name && date && contact.important_events.length < 5) {
      try {
        const parsedDate = new Date(date);
        if (!isNaN(parsedDate.getTime())) {
          // Convert to user's timezone and set to midnight
          const userDate = new Date(parsedDate.toLocaleString('en-US', { timeZone: timezone }));
          userDate.setHours(0, 0, 0, 0);
          contact.important_events.push({
            type: 'custom',
            name,
            date: userDate.toISOString()
          });
        }
      } catch (e) {
        console.error('Invalid custom event date:', date);
      }
    }
  }
}

async function* parseVCFChunks(file: File, timezone: string, chunkSize: number = 1024 * 1024): AsyncGenerator<Contact[]> {
  let buffer = '';
  const decoder = new TextDecoder();
  const reader = file.stream().getReader();
  const contacts: Contact[] = [];

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      
      buffer += decoder.decode(value, { stream: true });
      
      // Process complete vCards from buffer
      while (buffer.includes('END:VCARD')) {
        const endIndex = buffer.indexOf('END:VCARD') + 'END:VCARD'.length;
        const vcard = buffer.slice(0, endIndex);
        buffer = buffer.slice(endIndex);

        if (!vcard.includes('BEGIN:VCARD')) continue;

        const contact: Contact = {
          name: '',
          important_events: []
        };

        const lines = vcard.split('\n').map(line => line.trim());
        for (const line of lines) {
          processVCardLine(line, contact, timezone);
        }

        if (contact.name) {
          contacts.push(contact);
        }

        // Yield batch of contacts when size threshold is reached
        if (contacts.length >= 50) {
          yield contacts.splice(0);
        }
      }
    }

    // Decode any remaining chunks
    buffer += decoder.decode();

    // Process any remaining complete vCards
    while (buffer.includes('END:VCARD')) {
      const endIndex = buffer.indexOf('END:VCARD') + 'END:VCARD'.length;
      const vcard = buffer.slice(0, endIndex);
      buffer = buffer.slice(endIndex);

      if (!vcard.includes('BEGIN:VCARD')) continue;

      const contact: Contact = {
        name: '',
        important_events: []
      };

      const lines = vcard.split('\n').map(line => line.trim());
      for (const line of lines) {
        processVCardLine(line, contact, timezone);
      }

      if (contact.name) {
        contacts.push(contact);
      }
    }

    // Yield any remaining contacts
    if (contacts.length > 0) {
      yield contacts;
    }
  } finally {
    reader.releaseLock();
  }
}

async function checkDuplicateContacts(names: string[], supabase: any, userId: string): Promise<Set<string>> {
  const { data: duplicates } = await supabase
    .from('contacts')
    .select('name')
    .eq('user_id', userId)
    .in('name', names);

  return new Set(duplicates?.map(d => d.name.toLowerCase()) || []);
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    const headers = new Headers();
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'authorization, x-client-info, apikey, content-type');
    headers.set('Access-Control-Max-Age', '86400');
    headers.set('Access-Control-Allow-Credentials', 'true');
    return new Response(null, { headers });
  }

  // Set up a TransformStream for progress updates
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();
  const encoder = new TextEncoder();

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
    );

    // Get the session from the request
    const authorization = req.headers.get('Authorization');
    if (!authorization) {
      return createResponse(
        { error: 'No authorization header' },
        { status: 401 }
      );
    }

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(
      authorization.replace('Bearer ', '')
    );

    if (userError || !user) {
      return createResponse(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    // Process VCF file
    const formData = await req.formData();
    const file = formData.get('file');
    if (!file || !(file instanceof File)) {
      return createResponse(
        { error: 'No file provided' },
        { status: 400 }
      );
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

    const result: ImportResult = {
      success: true,
      message: 'Import completed',
      successCount: 0,
      failureCount: 0,
      errors: []
    };

    let processedCount = 0;
    const fileSize = file.size;
    
    // Process VCF in chunks
    for await (const contacts of parseVCFChunks(file, timezone)) {
      if (contacts.length === 0) continue;

      // Send progress update
      processedCount += contacts.length;
      const progress = {
        type: 'progress',
        processed: processedCount,
        total: fileSize,
        percent: Math.round((processedCount / fileSize) * 100)
      };
      await writer.write(encoder.encode(JSON.stringify(progress) + '\n'));

      // Validate names and check duplicates in batch
      const validContacts = contacts.filter(contact => contact.name?.trim());
      const invalidContacts = contacts.filter(contact => !contact.name?.trim());
      
      // Update result for invalid contacts
      invalidContacts.forEach((_, idx) => {
        result.failureCount++;
        result.errors.push({
          row: result.successCount + result.failureCount,
          errors: ['Name is required']
        });
      });

      if (validContacts.length === 0) continue;

      // Check duplicates in batch
      const validNames = validContacts.map(c => c.name.trim().toLowerCase());
      const duplicateNames = await checkDuplicateContacts(validNames, supabaseClient, user.id);
      
      // Prepare batch inserts for non-duplicate contacts
      const contactsToInsert = validContacts.filter(c => !duplicateNames.has(c.name.trim().toLowerCase())).map(contact => ({
        user_id: user.id,
        name: contact.name.trim(),
        phone: contact.phone || null,
        social_media_platform: contact.social_media_platform || null,
        social_media_handle: contact.social_media_handle || null,
        preferred_contact_method: contact.phone ? 'call' : 'message',
        contact_frequency: 'monthly',
        // Set next_contact_due and last_contacted in user's timezone
        next_contact_due: new Date(new Date().toLocaleString('en-US', { timeZone: timezone })).toISOString(),
        last_contacted: new Date(new Date().toLocaleString('en-US', { timeZone: timezone })).toISOString(),
        missed_interactions: 0,
        notes: ''
      }));

      // Update result for duplicate contacts
      validContacts.forEach((contact) => {
        if (duplicateNames.has(contact.name.trim().toLowerCase())) {
          result.failureCount++;
          result.errors.push({
            row: result.successCount + result.failureCount,
            errors: [`Contact with name '${contact.name}' already exists`]
          });
        }
      });

      if (contactsToInsert.length === 0) continue;

      // Bulk insert contacts
      const { data: newContacts, error: insertError } = await supabaseClient
        .from('contacts')
        .insert(contactsToInsert)
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

      // Prepare events and reminders for bulk insert
      const allEvents = [];
      const allReminders = [];
      const today = dayjs().startOf('day');

      newContacts.forEach((newContact) => {
        const contact = validContacts.find(c => c.name.trim() === newContact.name);
        if (!contact) return;

        // Process important events if they exist
        if (contact.important_events.length > 0) {
          const events = contact.important_events.map(event => ({
            contact_id: newContact.id,
            user_id: user.id,
            type: event.type,
            name: event.type === 'custom' ? event.name : null,
            date: event.date
          }));

          allEvents.push(...events);
        }

        // Calculate next due date in user's timezone
        const regularDueDate = calculateNextContactDate('monthly', 0, now, timezone);
        let nextDueDate = regularDueDate;

        // If contact has events, check if any should override the regular due date
        if (contact.important_events.length > 0) {
          const nextImportantEvent = contact.important_events
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

          if (nextImportantEvent) {
            if (dayjs(regularDueDate).isSame(today, 'day')) {
              nextDueDate = nextImportantEvent;
            } else if (!dayjs(nextImportantEvent).isSame(today, 'day') && nextImportantEvent < regularDueDate) {
              nextDueDate = nextImportantEvent;
            }
          }
        }

        // Update contact's next_due_date
        newContact.next_contact_due = nextDueDate.toISOString();

        // Add reminder
        allReminders.push({
          contact_id: newContact.id,
          user_id: user.id,
          type: newContact.preferred_contact_method,
          due_date: nextDueDate.toISOString(),
          completed: false
        });
      });

      // Bulk update contacts with next_due_dates
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

    // Send final result through stream
    await writer.write(encoder.encode(JSON.stringify({ type: 'result', ...result }) + '\n'));
    await writer.close();

    // Set up streaming response with proper CORS headers
    const headers = new Headers();
    headers.set('Content-Type', 'text/event-stream');
    headers.set('Cache-Control', 'no-cache');
    headers.set('Connection', 'keep-alive');
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'authorization, x-client-info, apikey, content-type');
    headers.set('Access-Control-Max-Age', '86400');
    headers.set('Access-Control-Allow-Credentials', 'true');

    return new Response(stream.readable, { headers });
  } catch (error) {
    console.error('Error processing VCF import:', error);
    // Close stream with error
    const errorResult = {
      type: 'result',
      success: false,
      message: error.message,
      successCount: 0,
      failureCount: 0,
      errors: [{ row: 0, errors: [error.message] }]
    };
    await writer.write(encoder.encode(JSON.stringify(errorResult) + '\n'));
    await writer.close();

    // Set up error response with proper CORS headers
    const headers = new Headers();
    headers.set('Content-Type', 'text/event-stream');
    headers.set('Cache-Control', 'no-cache');
    headers.set('Connection', 'keep-alive');
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'authorization, x-client-info, apikey, content-type');
    headers.set('Access-Control-Max-Age', '86400');
    headers.set('Access-Control-Allow-Credentials', 'true');

    return new Response(stream.readable, { status: 500, headers });
  }
});