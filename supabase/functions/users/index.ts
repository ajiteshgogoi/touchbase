import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing environment variables');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Notification window configuration
const NOTIFICATION_WINDOWS = [
  { type: 'morning', hour: 9, requiresDueReminders: false },
  { type: 'afternoon', hour: 14, requiresDueReminders: true },
  { type: 'evening', hour: 19, requiresDueReminders: true }
] as const;

type NotificationWindow = typeof NOTIFICATION_WINDOWS[number];
type NotificationType = NotificationWindow['type'];

// Window buffer in hours - how long past the window's hour we'll still consider valid
const WINDOW_BUFFER_HOURS = 2;

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
    console.log('Fetching users needing notifications');
    
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    // Get today's notifications to exclude already notified users
    const { data: notifiedUsers, error: notifiedError } = await supabase
      .from('notification_history')
      .select('user_id')
      .gte('sent_at', todayStart.toISOString())
      .in('notification_type', NOTIFICATION_WINDOWS.map(w => w.type));

    if (notifiedError) {
      console.error('Error fetching notified users:', notifiedError);
      throw notifiedError;
    }

    // Create set of notified user IDs for efficient lookup
    const notifiedUserIds = new Set(notifiedUsers?.map(u => u.user_id) || []);

    // Get users with valid FCM tokens and timezone preferences
    const { data: users, error: usersError } = await supabase
      .from('push_subscriptions')
      .select(`
        user_id,
        fcm_token,
        preferences:user_preferences(timezone)
      `)
      .not('fcm_token', 'is', null);

    if (usersError) {
      console.error('Error fetching users:', usersError);
      throw usersError;
    }

    if (!users) {
      console.log('No users found');
      return new Response(
        JSON.stringify([]),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Filter users who:
    // 1. Haven't been notified today
    // 2. Are in their notification window
    const eligibleUsers = users.reduce<Array<{userId: string, windowType: NotificationType}>>((acc, user) => {
      // Skip if already notified today
      if (notifiedUserIds.has(user.user_id)) {
        return acc;
      }

      const timezone = user.preferences?.timezone || 'UTC';
      const userTime = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
      const currentHour = userTime.getHours();
      
      // Find appropriate notification window
      const currentWindow = NOTIFICATION_WINDOWS.find(w => {
        const hourDiff = (currentHour - w.hour + 24) % 24;
        return hourDiff <= WINDOW_BUFFER_HOURS;
      });

      if (currentWindow) {
        acc.push({
          userId: user.user_id,
          windowType: currentWindow.type
        });
      }
      
      return acc;
    }, []);

    console.log(`Found ${eligibleUsers.length} users eligible for notifications`);
    
    return new Response(
      JSON.stringify(eligibleUsers),
      { 
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        } 
      }
    );
  } catch (error) {
    console.error('Error in users function:', error);
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