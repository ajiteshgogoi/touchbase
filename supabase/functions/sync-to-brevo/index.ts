import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const BREVO_API_KEY = Deno.env.get('BREVO_API_KEY');

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !BREVO_API_KEY) {
  throw new Error('Missing environment variables');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface AuthUser {
  id: string;
  email: string;
  created_at: string;
  user_metadata?: {
    name?: string;
  };
}

interface WebhookPayload {
  type: 'INSERT' | 'UPDATE';
  table: string;
  record: AuthUser;
  schema: string;
  old_record: null | AuthUser;
}

async function addContactToBrevo(user: AuthUser) {
  try {
    console.log('Sending user to Brevo:', {
      email: user.email,
      metadata: user.user_metadata
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
          SIGN_UP_DATE: user.created_at
        },
        listIds: [4], // Replace with your actual Brevo list ID
        updateEnabled: true
      })
    });

    // Log the raw response for debugging
    const responseText = await response.text();
    console.log('Brevo API Response:', {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      body: responseText
    });

    // Parse response
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

    // Only process new user insertions in auth.users
    if (payload.schema !== 'auth' || 
        payload.table !== 'users' || 
        payload.type !== 'INSERT') {
      console.log('Ignoring webhook - not a new user event:', {
        schema: payload.schema,
        table: payload.table,
        type: payload.type
      });
      return new Response(
        JSON.stringify({ message: 'Ignored: Not a new user event' }),
        { 
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          } 
        }
      );
    }

    console.log('Processing new user:', {
      userId: payload.record.id,
      email: payload.record.email
    });

    // Sync user to Brevo
    const result = await addContactToBrevo(payload.record);

    console.log('Successfully synced to Brevo:', {
      userId: payload.record.id,
      brevoId: result.id
    });

    return new Response(
      JSON.stringify({ 
        message: 'User successfully synced to Brevo',
        userId: payload.record.id,
        brevoId: result.id
      }),
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