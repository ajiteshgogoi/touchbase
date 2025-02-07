import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_ANON_KEY) {
  throw new Error('Missing environment variables');
}

const getAllowedOrigins = () => {
  // Get allowed origins from environment variables
  const allowedOrigins = Deno.env.get('ALLOWED_ORIGINS')?.split(',') || [];
  if (allowedOrigins.length === 0) {
    console.warn('No ALLOWED_ORIGINS configured, defaulting to development URLs');
    return ['http://localhost:3000', 'http://localhost:5173'];
  }
  return allowedOrigins;
};

const getCorsHeaders = (req: Request) => {
  const origin = req.headers.get('origin');
  const allowedOrigins = getAllowedOrigins();
  
  return {
    'Access-Control-Allow-Origin': allowedOrigins.includes(origin) ? origin : allowedOrigins[0],
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Credentials': 'true'
  };
};

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { 
      status: 405,
      headers: corsHeaders
    });
  }
try {
  // Verify API key
  const apiKey = req.headers.get('apikey');
  if (apiKey !== SUPABASE_ANON_KEY) {
    console.error('Invalid API key');
    throw new Error('Unauthorized');
  }

  const authHeader = req.headers.get('Authorization');
  console.log('Auth header:', authHeader?.substring(0, 20) + '...');
  
  if (!authHeader) {
    throw new Error('No authorization header');
  }

    const token = authHeader.replace('Bearer ', '');
    console.log('Token (first 20 chars):', token.substring(0, 20) + '...');

    // Create admin client with service role key
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Verify admin client permissions
    const { error: adminError } = await supabase.auth.admin.listUsers();
    if (adminError) {
      console.error('Admin permissions check failed:', adminError);
      throw new Error('Service role key does not have admin permissions');
    }

    // Verify token and get user
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError) {
      console.error('User verification error:', userError);
      throw new Error('Invalid user token');
    }
    
    if (!user) {
      console.error('No user found for token');
      throw new Error('Invalid user token');
    }

    console.log('User verified:', user.id);
    const userId = user.id;

    // First get all contact IDs for this user
    const { data: contacts, error: contactsError } = await supabase
      .from('contacts')
      .select('id')
      .eq('user_id', userId);
    
    if (contactsError) {
      console.error('Error fetching contacts:', contactsError);
      throw contactsError;
    }

    const contactIds = contacts?.map(c => c.id) || [];
    console.log(`Found ${contactIds.length} contacts to delete`);

    // Delete all user data in transaction order
    if (contactIds.length > 0) {
      // Delete processing logs for user's contacts
      const { error: logsError } = await supabase
        .from('contact_processing_logs')
        .delete()
        .in('contact_id', contactIds);
      
      if (logsError) {
        console.error('Error deleting logs:', logsError);
        throw logsError;
      }

      // Delete reminders for user's contacts
      const { error: remindersError } = await supabase
        .from('reminders')
        .delete()
        .in('contact_id', contactIds);
      
      if (remindersError) {
        console.error('Error deleting reminders:', remindersError);
        throw remindersError;
      }
    }

    // Delete user's interactions
    const { error: interactionsError } = await supabase
      .from('interactions')
      .delete()
      .eq('user_id', userId);
    
    if (interactionsError) {
      console.error('Error deleting interactions:', interactionsError);
      throw interactionsError;
    }

    // Delete push subscriptions
    const { error: subscriptionsError } = await supabase
      .from('push_subscriptions')
      .delete()
      .eq('user_id', userId);
    
    if (subscriptionsError) {
      console.error('Error deleting subscriptions:', subscriptionsError);
      throw subscriptionsError;
    }

    // Delete user preferences
    const { error: preferencesError } = await supabase
      .from('user_preferences')
      .delete()
      .eq('user_id', userId);
    
    if (preferencesError) {
      console.error('Error deleting preferences:', preferencesError);
      throw preferencesError;
    }

    // Delete contacts
    const { error: contactsDeleteError } = await supabase
      .from('contacts')
      .delete()
      .eq('user_id', userId);
    
    if (contactsDeleteError) {
      console.error('Error deleting contacts:', contactsDeleteError);
      throw contactsDeleteError;
    }

    // Delete user subscriptions
    const { error: subscriptionError } = await supabase
      .from('subscriptions')
      .delete()
      .eq('user_id', userId);
    
    if (subscriptionError) {
      console.error('Error deleting subscriptions:', subscriptionError);
      throw subscriptionError;
    }

    console.log('All related data deleted, proceeding to delete auth record');

    // Finally delete the user auth record
    try {
      const { error: deleteUserError } = await supabase.auth.admin.deleteUser(userId);
      if (deleteUserError) {
        console.error('Error deleting user auth:', deleteUserError);
        throw new Error(`Failed to delete auth record: ${deleteUserError.message}`);
      }
      console.log('Successfully deleted user auth record and all related data');
    } catch (authError) {
      console.error('Unexpected error during auth deletion:', authError);
      throw new Error(`Auth deletion failed - please ensure user exists and token has required permissions: ${authError.message}`);
    }

    return new Response(
      JSON.stringify({ success: true }), 
      { 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );

  } catch (error) {
    console.error('Error in delete-user function:', error);

    // Preserve the specific error message from database operations
    const errorMessage = error instanceof Error
      ? error.message
      : 'Unknown error deleting user';

    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );
  }
});