import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing environment variables');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      },
    });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    // Get the current user's ID from their JWT
    const userClient = createClient(SUPABASE_URL, authHeader.replace('Bearer ', ''));
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      throw new Error('Invalid user token');
    }

    const userId = user.id;

    // Delete all user data in transaction order
    // First delete dependent tables
    await supabase.from('contact_processing_logs')
      .delete()
      .eq('contact_id', 'any', 
        supabase.from('contacts')
          .select('id')
          .eq('user_id', userId)
      );

    await supabase.from('interactions')
      .delete()
      .eq('user_id', userId);

    await supabase.from('reminders')
      .delete()
      .eq('contact_id', 'any',
        supabase.from('contacts')
          .select('id')
          .eq('user_id', userId)
      );

    await supabase.from('push_subscriptions')
      .delete()
      .eq('user_id', userId);

    await supabase.from('user_preferences')
      .delete()
      .eq('user_id', userId);

    await supabase.from('contacts')
      .delete()
      .eq('user_id', userId);

    // Finally delete the user auth record
    const { error: deleteUserError } = await supabase.auth.admin.deleteUser(userId);
    if (deleteUserError) {
      throw deleteUserError;
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error deleting user:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
});