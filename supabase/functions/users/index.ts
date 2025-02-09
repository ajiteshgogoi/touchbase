import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing environment variables');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Fixed batch size optimized for edge function performance
const BATCH_SIZE = 25;

type NotificationWindow = 'morning' | 'afternoon' | 'evening';

function getCurrentWindow(hour: number): NotificationWindow | null {
  if (hour >= 8 && hour < 10) return 'morning';
  if (hour >= 13 && hour < 15) return 'afternoon';
  if (hour >= 18 && hour < 20) return 'evening';
  return null;
}

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
    // Get pagination cursor
    const url = new URL(req.url);
    const lastProcessedUserId = url.searchParams.get('lastProcessedUserId') || '';

    console.log(`Fetching next batch after user ID: ${lastProcessedUserId}`);

    // Get users with active FCM tokens and their timezone preferences
    const { data: users, error: usersError } = await supabase
      .from('push_subscriptions')
      .select(`
        user_id,
        fcm_token,
        user_preferences!inner(timezone)
      `)
      .not('fcm_token', 'is', null)
      .order('user_id')
      .gt('user_id', lastProcessedUserId)
      .limit(BATCH_SIZE);

    if (usersError) {
      console.error('Error fetching users:', usersError);
      throw usersError;
    }

    if (!users?.length) {
      return new Response(
        JSON.stringify({
          users: [],
          hasMore: false,
          lastProcessedUserId: null
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    const now = new Date();
    const eligibleUsers = [];

    // Process each user
    for (const user of users) {
      const timezone = user.user_preferences?.timezone || 'UTC';
      const userTime = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
      const userHour = userTime.getHours();
      const currentWindow = getCurrentWindow(userHour);

      // Skip if not in a notification window
      if (!currentWindow) {
        continue;
      }

      // Check if already notified in this window
      const { data: recentNotification } = await supabase
        .from('notification_history')
        .select('id')
        .eq('user_id', user.user_id)
        .eq('notification_type', currentWindow)
        .gte('sent_at', userTime.toISOString().split('T')[0])
        .maybeSingle();

      if (recentNotification) {
        continue;
      }

      // For afternoon and evening windows, check for due reminders
      if (currentWindow !== 'morning') {
        const { count: dueCount } = await supabase
          .from('reminders')
          .select('id', { count: 'exact' })
          .eq('user_id', user.user_id)
          .eq('completed', false)
          .lte('due_date', userTime.toISOString().split('T')[0]);

        if (!dueCount) {
          continue;
        }
      }

      eligibleUsers.push({
        user_id: user.user_id,
        fcm_token: user.fcm_token,
        timezone,
        window: currentWindow
      });
    }

    const lastId = users[users.length - 1].user_id;
    const hasMore = users.length === BATCH_SIZE;

    return new Response(
      JSON.stringify({
        users: eligibleUsers,
        hasMore,
        lastProcessedUserId: lastId,
        timestamp: now.toISOString()
      }),
      { 
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    );

  } catch (error) {
    console.error('Error processing users:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
});