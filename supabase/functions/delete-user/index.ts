import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { createResponse, handleOptions } from '../_shared/headers.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_ANON_KEY) {
  throw new Error('Missing environment variables');
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return handleOptions();
  }

  if (req.method !== 'POST') {
    return createResponse(
      { error: 'Method not allowed' },
      { status: 405 }
    );
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

    // First verify the user's token and get their ID
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      console.error('User verification error:', userError);
      throw new Error('Invalid user token');
    }

    const userId = user.id;
    console.log('User verified:', userId);

    // Then verify admin permissions specifically for this user
    const { data: adminCheck, error: adminError } = await supabase.auth.admin.getUserById(userId);
    if (adminError || !adminCheck?.user) {
      console.error('Admin permissions check failed:', adminError);
      throw new Error('Service role key validation failed - please contact support');
    }

    // Verify the user exists in auth system
    const { data: authUser, error: authCheckError } = await supabase.auth.admin.getUserById(userId);
    if (authCheckError || !authUser?.user) {
      console.error('User not found in auth system:', authCheckError);
      throw new Error('User not found in auth system');
    }

    console.log('Starting data cleanup for user:', userId);
    
    // Delete contact_analytics first (no dependencies)
    const { error: analyticsError } = await supabase
      .from('contact_analytics')
      .delete()
      .eq('user_id', userId);
    
    if (analyticsError) {
      console.error('Error deleting analytics:', analyticsError);
      throw analyticsError;
    }

    // Delete notification_history (no dependencies)
    const { error: notificationError } = await supabase
      .from('notification_history')
      .delete()
      .eq('user_id', userId);
    
    if (notificationError) {
      console.error('Error deleting notification history:', notificationError);
      throw notificationError;
    }

    // Delete push_subscriptions (no dependencies)
    const { error: pushError } = await supabase
      .from('push_subscriptions')
      .delete()
      .eq('user_id', userId);
    
    if (pushError) {
      console.error('Error deleting push subscriptions:', pushError);
      throw pushError;
    }

    // Delete user_preferences (no dependencies)
    const { error: preferencesError } = await supabase
      .from('user_preferences')
      .delete()
      .eq('user_id', userId);
    
    if (preferencesError) {
      console.error('Error deleting preferences:', preferencesError);
      throw preferencesError;
    }

    // Delete subscriptions (no dependencies)
    const { error: subscriptionError } = await supabase
      .from('subscriptions')
      .delete()
      .eq('user_id', userId);
    
    if (subscriptionError) {
      console.error('Error deleting subscriptions:', subscriptionError);
      throw subscriptionError;
    }

    // Delete prompt_generation_logs (no dependencies)
    const { error: promptLogsError } = await supabase
      .from('prompt_generation_logs')
      .delete()
      .eq('user_id', userId);
    
    if (promptLogsError) {
      console.error('Error deleting prompt generation logs:', promptLogsError);
      throw promptLogsError;
    }

    // Delete content_reports (no dependencies)
    const { error: contentReportsError } = await supabase
      .from('content_reports')
      .delete()
      .eq('user_id', userId);
    
    if (contentReportsError) {
      console.error('Error deleting content reports:', contentReportsError);
      throw contentReportsError;
    }

    // Delete feedback (no dependencies)
    const { error: feedbackError } = await supabase
      .from('feedback')
      .delete()
      .eq('user_id', userId);
    
    if (feedbackError) {
      console.error('Error deleting feedback:', feedbackError);
      throw feedbackError;
    }

    // Delete all interactions
    const { error: interactionsError } = await supabase
      .from('interactions')
      .delete()
      .eq('user_id', userId);
    
    if (interactionsError) {
      console.error('Error deleting interactions:', interactionsError);
      throw interactionsError;
    }

    // Finally delete all contacts - this will cascade delete reminders and processing logs
    const { error: contactsError } = await supabase
      .from('contacts')
      .delete()
      .eq('user_id', userId);
    
    if (contactsError) {
      console.error('Error deleting contacts:', contactsError);
      throw contactsError;
    }

    console.log('All related data deleted, proceeding to delete auth record');

    // Delete the auth record with retries
    let retries = 3;
    while (retries > 0) {
      try {
        const { error: deleteUserError } = await supabase.auth.admin.deleteUser(userId);
        if (!deleteUserError) {
          console.log('Successfully deleted user auth record and all related data');
          return createResponse({ success: true });
        }
        console.error(`Error deleting user auth (${retries} retries left):`, deleteUserError);
        retries--;
        if (retries > 0) {
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s between retries
        }
      } catch (authError) {
        console.error(`Unexpected error during auth deletion (${retries} retries left):`, authError);
        retries--;
        if (retries > 0) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }

    throw new Error('Failed to delete user after multiple attempts - please try again later');

  } catch (error) {
    console.error('Error in delete-user function:', error);

    // Preserve the specific error message from database operations
    const errorMessage = error instanceof Error
      ? error.message
      : 'Unknown error deleting user';

    return createResponse(
      { error: errorMessage },
      { status: 500 }
    );
  }
});