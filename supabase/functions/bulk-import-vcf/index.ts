import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { createResponse, handleOptions } from '../_shared/headers.ts'
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

function parseVCF(vcfContent: string): Contact[] {
  const contacts: Contact[] = [];
  const vcards = vcfContent.split('BEGIN:VCARD').filter(card => card.trim());

  for (const vcard of vcards) {
    const lines = vcard.split('\n').map(line => line.trim());
    const contact: Contact = {
      name: '',
      important_events: []
    };

    for (const line of lines) {
      if (line.startsWith('FN:')) {
        contact.name = line.substring(3).trim();
      } else if (line.startsWith('TEL:')) {
        contact.phone = line.substring(4).trim();
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
              // Set time to midnight UTC
              parsedDate.setUTCHours(0, 0, 0, 0);
              contact.important_events.push({
                type: 'birthday',
                date: parsedDate.toISOString()
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
              // Set time to midnight UTC
              parsedDate.setUTCHours(0, 0, 0, 0);
              contact.important_events.push({
                type: 'anniversary',
                date: parsedDate.toISOString()
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
              // Set time to midnight UTC
              parsedDate.setUTCHours(0, 0, 0, 0);
              contact.important_events.push({
                type: 'custom',
                name,
                date: parsedDate.toISOString()
              });
            }
          } catch (e) {
            console.error('Invalid custom event date:', date);
          }
        }
      }
    }

    if (contact.name) {
      contacts.push(contact);
    }
  }

  return contacts;
}

async function checkDuplicateContact(name: string, supabase: any, userId: string): Promise<boolean> {
  const { data: duplicates } = await supabase
    .from('contacts')
    .select('id')
    .eq('user_id', userId)
    .ilike('name', name)
    .limit(1);

  return duplicates?.length > 0;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return handleOptions();
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

    try {
      // Read and parse VCF in memory
      const vcfContent = await file.text();
      const contacts = parseVCF(vcfContent);

      // Clear file data from memory
      formData.delete('file');

      const result: ImportResult = {
        success: true,
        message: 'Import completed',
        successCount: 0,
        failureCount: 0,
        errors: []
      };

      // Process contacts
      for (const [index, contact] of contacts.entries()) {
        // Validate contact name
        if (!contact.name?.trim()) {
          result.failureCount++;
          result.errors.push({
            row: index + 1,
            errors: ['Name is required']
          });
          continue;
        }

        // Check for duplicates
        const isDuplicate = await checkDuplicateContact(contact.name, supabaseClient, user.id);
        if (isDuplicate) {
          result.failureCount++;
          result.errors.push({
            row: index + 1,
            errors: [`Contact with name '${contact.name}' already exists`]
          });
          continue;
        }

        // Get user's timezone preference
        const { data: userPref } = await supabaseClient
          .from('user_preferences')
          .select('timezone')
          .eq('user_id', user.id)
          .single();

        // Use UTC if no timezone preference is set
        const timezone = userPref?.timezone || 'UTC';
        const now = new Date(new Date().toLocaleString('en-US', { timeZone: timezone }));

        // Insert contact with monthly frequency and get the new contact's ID
        const { data: newContact, error: insertError } = await supabaseClient
          .from('contacts')
          .insert({
            user_id: user.id,
            name: contact.name.trim(),
            phone: contact.phone || null,
            social_media_platform: contact.social_media_platform || null,
            social_media_handle: contact.social_media_handle || null,
            preferred_contact_method: contact.phone ? 'call' : 'message',
            contact_frequency: 'monthly', // Set default frequency to monthly
            next_contact_due: now.toISOString(),
            last_contacted: now.toISOString(),
            missed_interactions: 0
          })
          .select()
          .single();

        if (insertError || !newContact) {
          result.failureCount++;
          result.errors.push({
            row: index + 1,
            errors: [`Failed to insert contact: ${insertError?.message || 'Unknown error'}`]
          });
          continue;
        }

        // Insert important events if any
        if (contact.important_events.length > 0) {
          const { error: eventsError } = await supabaseClient
            .from('important_events')
            .insert(contact.important_events.map(event => ({
              contact_id: newContact.id,
              user_id: user.id,
              type: event.type,
              name: event.type === 'custom' ? event.name : null,
              date: event.date
            })));

          if (eventsError) {
            console.error('Failed to insert events:', eventsError);
            // Don't fail the whole import if events fail
            result.errors.push({
              row: index + 1,
              errors: [`Events not imported: ${eventsError.message}`]
            });
          }
        }

        result.successCount++;
      }

      return createResponse(result);
    } catch (error) {
      console.error('Error processing VCF import:', error);
      return createResponse(
        {
          success: false,
          message: error.message,
          successCount: 0,
          failureCount: 0,
          errors: [{ row: 0, errors: [error.message] }]
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error in serve handler:', error);
    return createResponse(
      {
        success: false,
        message: error.message,
        successCount: 0,
        failureCount: 0,
        errors: [{ row: 0, errors: [error.message] }]
      },
      { status: 500 }
    );
  }
});