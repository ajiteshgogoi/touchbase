import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { createResponse, handleOptions } from '../_shared/headers.ts';

interface CheckDuplicateRequest {
  name: string;
  user_id: string;
  contact_id?: string; // Optional: for update case
}

serve(async (req) => {
  const requestId = crypto.randomUUID();
  console.log('Starting duplicate check request:', { requestId });

  // Handle CORS
  if (req.method === 'OPTIONS') {
    console.log('Handling OPTIONS request:', { requestId });
    return handleOptions();
  }

  try {
    console.log('Processing request:', { requestId, method: req.method });
    const { name, user_id, contact_id } = await req.json() as CheckDuplicateRequest;
    console.log('Request params:', { requestId, name, userId: user_id, hasContactId: !!contact_id });

    // Input validation
    if (!name || !user_id) {
      console.log('Invalid request - missing required fields:', { requestId, name: !!name, userId: !!user_id });
      return createResponse(
        { error: 'Name and user_id are required' },
        { status: 400 }
      );
    }

    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    console.log('Supabase client created:', {
      requestId,
      hasUrl: !!Deno.env.get('SUPABASE_URL'),
      hasServiceKey: !!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    });

    // Build query to check for existing contacts with same name for this user
    console.log('Building duplicate check query:', { requestId });
    let query = supabaseClient
      .from('contacts')
      .select('id, name')
      .eq('user_id', user_id)
      .ilike('name', name);

    // If contact_id provided (update case), exclude the current contact
    if (contact_id) {
      console.log('Excluding current contact from check:', { requestId, contact_id });
      query = query.neq('id', contact_id);
    }

    console.log('Executing duplicate check query:', { requestId });
    const { data: existingContacts, error } = await query;

    if (error) {
      console.error('Database error checking for duplicates:', {
        requestId,
        error: error.message,
        details: error.details,
        hint: error.hint
      });
      return createResponse(
        { error: 'Error checking for duplicates' },
        { status: 500 }
      );
    }

    // Return the list of existing contacts with similar names
    console.log('Duplicate check results:', {
      requestId,
      hasDuplicates: existingContacts.length > 0,
      duplicateCount: existingContacts.length,
      duplicates: existingContacts.map(c => ({ id: c.id, name: c.name }))
    });

    return createResponse({
      hasDuplicate: existingContacts.length > 0,
      duplicates: existingContacts
    });

  } catch (error) {
    console.error('Duplicate check error:', {
      requestId,
      error: error.message,
      stack: error.stack,
      type: error.name
    });
    return createResponse(
      { error: error.message },
      { status: 500 }
    );
  }
});