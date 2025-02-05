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
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Authorization',
      },
    });
  }

  try {
    console.log('Fetching users with FCM tokens');
    
    // Get total count of FCM tokens for debugging
    const { count: totalCount, error: countError } = await supabase
      .from('push_subscriptions')
      .select('fcm_token', { count: 'exact' })
      .not('fcm_token', 'is', null);

    if (countError) {
      console.error('Error getting total count:', countError);
    } else {
      console.log(`Total FCM tokens in database: ${totalCount}`);
    }

    // Log token stats for debugging
    const { data: tokenStats, error: statsError } = await supabase
      .from('push_subscriptions')
      .select('user_id, created_at');
    
    if (statsError) {
      console.error('Error getting token stats:', statsError);
    } else {
      console.log('Token stats:', tokenStats.map(s => ({
        user_id: s.user_id,
        created_at: s.created_at
      })));
    }

    // Get all users who have FCM tokens
    const { data: users, error } = await supabase
      .from('push_subscriptions')
      .select('user_id, fcm_token')
      .not('fcm_token', 'is', null);

    if (error) {
      console.error('Error fetching users:', error);
      throw error;
    }

    const userIds = users.map(u => u.user_id);
    console.log(`Found ${userIds.length} users with active FCM tokens`);
    
    // Log FCM token details for debugging
    users.forEach(user => {
      console.log(`\nUser ${user.user_id}:`);
      console.log('Has FCM token:', !!user.fcm_token);
    });

    return new Response(
      JSON.stringify(userIds),
      {
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('Error fetching users:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500 }
    );
  }
});