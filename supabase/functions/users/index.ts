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

function logStep(step: string, data?: any) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${step}`);
  if (data) {
    console.log(`[${timestamp}] Data:`, JSON.stringify(data, null, 2));
  }
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
    logStep('Starting notification eligibility check');
    
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    logStep('Fetching notification history');
    // Get today's notifications to exclude already notified users
    const { data: notifiedUsers, error: notifiedError } = await supabase
      .from('notification_history')
      .select('user_id')
      .gte('sent_at', todayStart.toISOString())
      .in('notification_type', NOTIFICATION_WINDOWS.map(w => w.type));

    if (notifiedError) {
      logStep('Error fetching notification history', notifiedError);
      throw notifiedError;
    }

    logStep(`Found ${notifiedUsers?.length || 0} users already notified today`);

    // Create set of notified user IDs for efficient lookup
    const notifiedUserIds = new Set(notifiedUsers?.map(u => u.user_id) || []);

    logStep('Fetching push subscriptions');
    // Get users with valid FCM tokens
    const { data: subscriptions, error: subsError } = await supabase
      .from('push_subscriptions')
      .select('user_id, fcm_token')
      .not('fcm_token', 'is', null);

    if (subsError) {
      logStep('Error fetching push subscriptions', subsError);
      throw subsError;
    }

    if (!subscriptions?.length) {
      logStep('No subscribed users found');
      return new Response(
        JSON.stringify([]),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    logStep(`Found ${subscriptions.length} users with valid FCM tokens`);

    logStep('Fetching user preferences');
    // Get user preferences
    const { data: preferences, error: prefError } = await supabase
      .from('user_preferences')
      .select('user_id, timezone')
      .in('user_id', subscriptions.map(s => s.user_id));

    if (prefError) {
      logStep('Error fetching user preferences', prefError);
      throw prefError;
    }

    logStep(`Found ${preferences?.length || 0} user preferences`);

    // Create map of user preferences for efficient lookup
    const preferenceMap = new Map(
      preferences?.map(p => [p.user_id, p.timezone]) || []
    );

    logStep('Processing time windows');
    // Filter users who:
    // 1. Haven't been notified today
    // 2. Are in their notification window
    const eligibleUsers = subscriptions.reduce<Array<{userId: string, windowType: NotificationType}>>((acc, sub) => {
      // Skip if already notified today
      if (notifiedUserIds.has(sub.user_id)) {
        return acc;
      }

      const timezone = preferenceMap.get(sub.user_id) || 'UTC';
      const userTime = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
      const currentHour = userTime.getHours();
      
      // Find appropriate notification window
      const currentWindow = NOTIFICATION_WINDOWS.find(w => {
        const hourDiff = (currentHour - w.hour + 24) % 24;
        return hourDiff <= WINDOW_BUFFER_HOURS;
      });

      if (currentWindow) {
        acc.push({
          userId: sub.user_id,
          windowType: currentWindow.type
        });
      }
      
      return acc;
    }, []);

    logStep(`Found ${eligibleUsers.length} users eligible for notifications`, {
      eligibleUserCount: eligibleUsers.length,
      firstWindow: eligibleUsers[0]?.windowType,
      userTimezones: [...preferenceMap.values()]
    });
    
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
    logStep('Error in users function', {
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