import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing environment variables');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Notification window configuration
// Each window defines when notifications can be sent in the user's local timezone
// - type: Identifier for the notification window
// - hour: Hour in 24-hour format when this window starts
// - requiresDueReminders: Whether notifications in this window require due reminders
//
// Adjust these windows based on your notification strategy:
// - Add/remove windows for different notification frequencies
// - Adjust hours based on user engagement patterns
// - Modify requiresDueReminders based on notification urgency
const NOTIFICATION_WINDOWS = [
  { type: 'morning', hour: 9, requiresDueReminders: false },
  { type: 'afternoon', hour: 14, requiresDueReminders: true },
  { type: 'evening', hour: 19, requiresDueReminders: true }
];

// Window buffer in hours
// How much past the window's hour we'll still consider valid
// Increase if GitHub Actions timing is inconsistent
// Decrease for stricter timing adherence
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

    // Get users who:
    // 1. Have valid FCM tokens
    // 2. Haven't been notified today
    // 3. Have timezone preferences set
    const { data: users, error } = await supabase
      .from('push_subscriptions AS ps')
      .select(`
        user_id,
        user_preferences!inner(timezone)
      `)
      .not('fcm_token', 'is', null)
      .not(
        'user_id', 'in',
        supabase
          .from('notification_history')
          .select('user_id')
          .gte('sent_at', todayStart.toISOString())
          .in('notification_type', NOTIFICATION_WINDOWS.map(w => w.type))
      )
      .order('user_id');

    if (error) {
      console.error('Error fetching users:', error);
      throw error;
    }

    // Filter users who are currently in their notification window
    // and include the window type for each user
    const eligibleUsers = users.reduce((acc: Array<{userId: string, windowType: string}>, user) => {
      const timezone = user.user_preferences?.timezone || 'UTC';
      const userTime = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
      const currentHour = userTime.getHours();
      
      for (const window of NOTIFICATION_WINDOWS) {
        const hourDiff = (currentHour - window.hour + 24) % 24;
        if (hourDiff <= WINDOW_BUFFER_HOURS) {
          acc.push({
            userId: user.user_id,
            windowType: window.type
          });
          break; // User is only eligible for one window at a time
        }
      }
      
      return acc;
    }, []);

    console.log(`Found ${eligibleUsers.length} users eligible for notifications`);
    
    return new Response(
      JSON.stringify(eligibleUsers),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error fetching users:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500 }
    );
  }
});