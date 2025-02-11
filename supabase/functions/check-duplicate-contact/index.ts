import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

function addCorsHeaders(headers: Headers = new Headers()) {
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  headers.set('Access-Control-Max-Age', '86400');
  headers.set('Access-Control-Allow-Credentials', 'true');
  return headers;
}

interface CheckDuplicateRequest {
  name: string;
  user_id: string;
  contact_id?: string; // Optional: for update case
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: addCorsHeaders() });
  }

  try {
    const { name, user_id, contact_id } = await req.json() as CheckDuplicateRequest;

    // Input validation
    if (!name || !user_id) {
      return new Response(
        JSON.stringify({ error: 'Name and user_id are required' }),
        {
          status: 400,
          headers: addCorsHeaders(new Headers({ 'Content-Type': 'application/json' }))
        }
      );
    }

    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Build query to check for existing contacts with same name for this user
    let query = supabaseClient
      .from('contacts')
      .select('id, name')
      .eq('user_id', user_id)
      .ilike('name', name);

    // If contact_id provided (update case), exclude the current contact
    if (contact_id) {
      query = query.neq('id', contact_id);
    }

    const { data: existingContacts, error } = await query;

    if (error) {
      console.error('Error checking for duplicates:', error);
      return new Response(
        JSON.stringify({ error: 'Error checking for duplicates' }),
        {
          status: 500,
          headers: addCorsHeaders(new Headers({ 'Content-Type': 'application/json' }))
        }
      );
    }

    // Return the list of existing contacts with similar names
    return new Response(
      JSON.stringify({
        hasDuplicate: existingContacts.length > 0,
        duplicates: existingContacts
      }),
      {
        headers: addCorsHeaders(new Headers({ 'Content-Type': 'application/json' }))
      }
    );

  } catch (error) {
    console.error('Check duplicate contact error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: addCorsHeaders(new Headers({ 'Content-Type': 'application/json' }))
      }
    );
  }
});