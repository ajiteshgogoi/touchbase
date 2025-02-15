import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const BREVO_API_KEY = Deno.env.get('BREVO_API_KEY');

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !BREVO_API_KEY) {
  throw new Error('Missing environment variables');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Brevo list IDs
const ACTIVE_USERS_LIST = 4;
const DELETED_USERS_LIST = 5;

interface AuthUser {
  id: string;
  email: string;
  created_at: string;
  user_metadata?: {
    name?: string;
  };
}

interface WebhookPayload {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  record: AuthUser;
  schema: string;
  old_record: null | AuthUser;
}

async function addContactToBrevo(user: AuthUser) {
  try {
    console.log('Sending user to Brevo:', {
      email: user.email,
      metadata: user.user_metadata,
      list: ACTIVE_USERS_LIST
    });

    const response = await fetch('https://api.brevo.com/v3/contacts', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'api-key': BREVO_API_KEY
      },
      body: JSON.stringify({
        email: user.email,
        attributes: {
          FIRSTNAME: user.user_metadata?.name?.split(' ')[0] || '',
          LASTNAME: user.user_metadata?.name?.split(' ').slice(1).join(' ') || '',
          SIGN_UP_DATE: user.created_at,
          DELETED_AT: null,
          ACCOUNT_DELETED: false
        },
        emailBlacklisted: false,
        smsBlacklisted: false,
        listIds: [ACTIVE_USERS_LIST],
        unlinkListIds: [DELETED_USERS_LIST], // Remove from deleted list if they were there
        updateEnabled: true
      })
    });

    const responseText = await response.text();
    console.log('Brevo API Response:', {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      body: responseText
    });

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      throw new Error(`Invalid JSON response: ${responseText}`);
    }

    if (!response.ok) {
      throw new Error(`Brevo API error: ${JSON.stringify(data)}`);
    }

    return data;
  } catch (error) {
    console.error('Error in addContactToBrevo:', error);
    throw error;
  }
}

async function unsubscribeContactFromBrevo(email: string) {
  try {
    console.log('Moving user to deleted list in Brevo:', { 
      email,
      toList: DELETED_USERS_LIST,
      fromList: ACTIVE_USERS_LIST
    });

    // First get the contact ID
    const response = await fetch(`https://api.brevo.com/v3/contacts/${encodeURIComponent(email)}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'api-key': BREVO_API_KEY
      }
    });

    if (!response.ok) {
      if (response.status === 404) {
        console.log('Contact not found in Brevo:', { email });
        return;
      }
      throw new Error(`Failed to get contact: ${await response.text()}`);
    }

    // Move contact to deleted list
    const updateResponse = await fetch('https://api.brevo.com/v3/contacts', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'api-key': BREVO_API_KEY
      },
      body: JSON.stringify({
        email,
        attributes: {
          DELETED_AT: new Date().toISOString(),
          ACCOUNT_DELETED: true
        },
        emailBlacklisted: true,
        smsBlacklisted: true,
        listIds: [DELETED_USERS_LIST], // Add to deleted list
        unlinkListIds: [ACTIVE_USERS_LIST], // Remove from active list
        updateEnabled: true
      })
    });

    if (!updateResponse.ok) {
      throw new Error(`Failed to move contact to deleted list: ${await updateResponse.text()}`);
    }

    console.log('Successfully moved user to deleted list in Brevo:', { email });
  } catch (error) {
    console.error('Error in unsubscribeContactFromBrevo:', error);
    throw error;
  }
}

serve(async (req) => {
  console.log('Received webhook request:', {
    method: req.method,
    url: req.url,
    headers: Object.fromEntries(req.headers.entries())
  });

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      },
    });
  }

  try {
    // Allow both GET and POST methods
    if (req.method !== 'GET' && req.method !== 'POST') {
      throw new Error('Method not allowed');
    }

    // For GET requests, return a simple status check
    if (req.method === 'GET') {
      return new Response(
        JSON.stringify({ status: 'healthy' }),
        { 
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          } 
        }
      );
    }

    // Log the raw request body for debugging
    const rawBody = await req.text();
    console.log('Raw webhook payload:', rawBody);

    let payload: WebhookPayload;
    try {
      payload = JSON.parse(rawBody);
    } catch (e) {
      console.error('Failed to parse webhook payload:', e);
      throw new Error(`Invalid JSON payload: ${rawBody}`);
    }

    console.log('Parsed webhook payload:', {
      type: payload.type,
      schema: payload.schema,
      table: payload.table,
      recordId: payload.record?.id
    });

    // Check if this is an auth.users event
    if (payload.schema !== 'auth' || payload.table !== 'users') {
      console.log('Ignoring webhook - not an auth.users event');
      return new Response(
        JSON.stringify({ message: 'Ignored: Not an auth.users event' }),
        { 
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          } 
        }
      );
    }

    // Handle based on operation type
    if (payload.type === 'INSERT') {
      console.log('Processing new user:', {
        userId: payload.record.id,
        email: payload.record.email
      });

      const result = await addContactToBrevo(payload.record);

      return new Response(
        JSON.stringify({ 
          message: 'User successfully added to active list in Brevo',
          userId: payload.record.id,
          brevoId: result.id,
          list: ACTIVE_USERS_LIST
        }),
        { 
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    } else if (payload.type === 'DELETE' && payload.old_record) {
      console.log('Processing user deletion:', {
        userId: payload.old_record.id,
        email: payload.old_record.email
      });

      await unsubscribeContactFromBrevo(payload.old_record.email);

      return new Response(
        JSON.stringify({ 
          message: 'User successfully moved to deleted list in Brevo',
          email: payload.old_record.email,
          list: DELETED_USERS_LIST
        }),
        { 
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    }

    // Ignore other operation types
    return new Response(
      JSON.stringify({ message: `Ignored: ${payload.type} operation` }),
      { 
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        } 
      }
    );

  } catch (error) {
    console.error('Error in sync-to-brevo function:', {
      error: error.message,
      stack: error.stack
    });

    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: error.stack
      }),
      { 
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    );
  }
});