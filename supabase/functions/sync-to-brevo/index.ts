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
  raw_user_meta_data?: {
    full_name?: string;
    name?: string;
    email?: string;
  };
  user_metadata?: {
    full_name?: string;
    name?: string;
    email?: string;
  };
  created_at: string;
}

interface WebhookPayload {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  record: AuthUser;
  schema: string;
  old_record: null | AuthUser;
}

async function getFullUserData(userId: string): Promise<AuthUser | null> {
  const { data: { user }, error } = await supabase.auth.admin.getUserById(userId);
  if (error) {
    console.error('Error fetching user data:', error);
    return null;
  }
  return user;
}

function extractUserName(user: AuthUser): { firstName: string; lastName: string } {
  // Log all potential name sources
  console.log('Name data sources:', {
    rawMetaFullName: user.raw_user_meta_data?.full_name,
    rawMetaName: user.raw_user_meta_data?.name,
    metaFullName: user.user_metadata?.full_name,
    metaName: user.user_metadata?.name
  });

  // Try all possible sources for the name
  const fullName = user.raw_user_meta_data?.full_name || 
                  user.raw_user_meta_data?.name ||
                  user.user_metadata?.full_name ||
                  user.user_metadata?.name ||
                  '';

  const nameParts = fullName.split(' ');
  return {
    firstName: nameParts[0] || '',
    lastName: nameParts.slice(1).join(' ') || ''
  };
}

async function addContactToBrevo(user: AuthUser) {
  try {
    // Get full user data if webhook payload doesn't include metadata
    const fullUser = user.user_metadata || user.raw_user_meta_data ? 
                    user : 
                    await getFullUserData(user.id);

    if (!fullUser) {
      throw new Error(`Could not get full user data for ${user.id}`);
    }

    const { firstName, lastName } = extractUserName(fullUser);

    console.log('Sending user to Brevo:', {
      email: user.email,
      firstName,
      lastName,
      metadata: {
        raw: fullUser.raw_user_meta_data,
        user: fullUser.user_metadata
      },
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
          FIRSTNAME: firstName,
          LASTNAME: lastName,
          SIGN_UP_DATE: user.created_at,
          DELETED_AT: null,
          ACCOUNT_DELETED: false
        },
        emailBlacklisted: false,
        smsBlacklisted: false,
        listIds: [ACTIVE_USERS_LIST],
        unlinkListIds: [DELETED_USERS_LIST],
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

    // For 204 No Content, return success without parsing JSON
    if (response.status === 204) {
      return { id: 'success_no_content' };
    }

    // For other successful responses, try parsing JSON
    if (response.ok) {
      try {
        return responseText ? JSON.parse(responseText) : { id: 'success_empty_response' };
      } catch (e) {
        console.log('Warning: Could not parse successful response as JSON:', responseText);
        return { id: 'success_non_json' };
      }
    }

    // For error responses, try to parse error details
    try {
      const errorData = responseText ? JSON.parse(responseText) : { message: response.statusText };
      throw new Error(`Brevo API error: ${JSON.stringify(errorData)}`);
    } catch (e) {
      throw new Error(`Brevo API error: ${response.status} ${response.statusText} - ${responseText}`);
    }
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
        listIds: [DELETED_USERS_LIST],
        unlinkListIds: [ACTIVE_USERS_LIST],
        updateEnabled: true
      })
    });

    const responseText = await updateResponse.text();
    console.log('Brevo unsubscribe response:', {
      status: updateResponse.status,
      statusText: updateResponse.statusText,
      body: responseText
    });

    if (!updateResponse.ok && updateResponse.status !== 204) {
      throw new Error(`Failed to move contact to deleted list: ${responseText}`);
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

  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type',
        'X-Frame-Options': 'SAMEORIGIN',
        'Content-Security-Policy': "frame-ancestors 'self'; object-src 'none'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; require-trusted-types-for 'script'"
      },
    });
  }

  try {
    if (req.method !== 'GET' && req.method !== 'POST') {
      throw new Error('Method not allowed');
    }

    if (req.method === 'GET') {
      return new Response(
        JSON.stringify({ status: 'healthy' }),
        { 
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'X-Frame-Options': 'SAMEORIGIN',
            'Content-Security-Policy': "frame-ancestors 'self'; object-src 'none'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; require-trusted-types-for 'script'"
          }
        }
      );
    }

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
      recordId: payload.record?.id,
      metadata: {
        raw: payload.record?.raw_user_meta_data,
        user: payload.record?.user_metadata
      }
    });

    if (payload.schema !== 'auth' || payload.table !== 'users') {
      console.log('Ignoring webhook - not an auth.users event');
      return new Response(
        JSON.stringify({ message: 'Ignored: Not an auth.users event' }),
        { 
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'X-Frame-Options': 'SAMEORIGIN',
            'Content-Security-Policy': "frame-ancestors 'self'; object-src 'none'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; require-trusted-types-for 'script'"
          }
        }
      );
    }

    if (payload.type === 'INSERT') {
      console.log('Processing new user:', {
        userId: payload.record.id,
        email: payload.record.email,
        metadata: {
          raw: payload.record.raw_user_meta_data,
          user: payload.record.user_metadata
        }
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
            'Access-Control-Allow-Origin': '*',
            'X-Frame-Options': 'SAMEORIGIN',
            'Content-Security-Policy': "frame-ancestors 'self'; object-src 'none'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; require-trusted-types-for 'script'"
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
            'Access-Control-Allow-Origin': '*',
            'X-Frame-Options': 'SAMEORIGIN',
            'Content-Security-Policy': "frame-ancestors 'self'; object-src 'none'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; require-trusted-types-for 'script'"
          }
        }
      );
    }

    return new Response(
      JSON.stringify({ message: `Ignored: ${payload.type} operation` }),
      { 
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'X-Frame-Options': 'SAMEORIGIN',
          'Content-Security-Policy': "frame-ancestors 'self'; object-src 'none'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; require-trusted-types-for 'script'"
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