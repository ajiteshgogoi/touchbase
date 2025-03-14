import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { createResponse, handleOptions } from '../_shared/headers.ts'

interface Contact {
  name: string
  phone?: string
  social_media_platform?: string
  social_media_handle?: string
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

function parseVCF(vcfContent: string): Contact[] {
  const contacts: Contact[] = [];
  const vcards = vcfContent.split('BEGIN:VCARD').filter(card => card.trim());

  for (const vcard of vcards) {
    const lines = vcard.split('\n').map(line => line.trim());
    const contact: Contact = { name: '' };

    for (const line of lines) {
      if (line.startsWith('FN:')) {
        contact.name = line.substring(3).trim();
      } else if (line.startsWith('TEL:')) {
        contact.phone = line.substring(4).trim();
      } else if (line.startsWith('X-SOCIALPROFILE;') || line.startsWith('SOCIALPROFILE;')) {
        const match = line.match(/TYPE=(\w+):(.+)/i);
        if (match) {
          const platform = match[1].toLowerCase();
          const handle = match[2].trim();
          if (['linkedin', 'instagram', 'twitter'].includes(platform)) {
            contact.social_media_platform = platform;
            contact.social_media_handle = handle;
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

        // Insert contact with monthly frequency
        const { error: insertError } = await supabaseClient
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
          });

        if (insertError) {
          result.failureCount++;
          result.errors.push({
            row: index + 1,
            errors: [`Failed to insert contact: ${insertError.message}`]
          });
          continue;
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