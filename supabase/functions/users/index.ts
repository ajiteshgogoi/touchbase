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
    console.log('Fetching users with active push subscriptions');
    
    // Get all users who have push subscriptions
    // First, let's log total subscriptions for debugging
    const { count: totalCount, error: countError } = await supabase
      .from('push_subscriptions')
      .select('*', { count: 'exact' });

    if (countError) {
      console.error('Error getting total count:', countError);
    } else {
      console.log(`Total subscriptions in database: ${totalCount}`);
    }

    // Log raw table data for debugging
    const { data: allSubs, error: allSubsError } = await supabase
      .from('push_subscriptions')
      .select('*');
    
    if (allSubsError) {
      console.error('Error getting all subscriptions:', allSubsError);
    } else {
      console.log('All subscriptions:', JSON.stringify(allSubs, null, 2));
    }

    // Get all users who have push subscriptions with non-null endpoints
    const { data: users, error } = await supabase
      .from('push_subscriptions')
      .select('user_id, subscription')
      .not('subscription', 'is', null);

    if (error) {
      console.error('Error fetching users:', error);
      throw error;
    }

    const userIds = users.map(u => u.user_id);
    console.log(`Found ${userIds.length} users with active subscriptions`);
    
    // Log subscription details for debugging
    // Log detailed subscription info
    users.forEach(user => {
      console.log(`\nUser ${user.user_id} subscription:`);
      console.log('Raw subscription:', JSON.stringify(user.subscription, null, 2));
      
      const subscription = typeof user.subscription === 'string'
        ? JSON.parse(user.subscription)
        : user.subscription;
      
      console.log('Parsed subscription:', JSON.stringify({
        endpoint: subscription?.endpoint || 'none',
        keys: subscription?.keys ? 'present' : 'absent'
      }, null, 2));
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