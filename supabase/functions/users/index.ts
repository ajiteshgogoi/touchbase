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
    console.log('Starting notification eligibility check');
    
    const now = new Date();
    console.log('Fetching notification history');

    // Get all notifications from the last 24 hours to account for different timezones
    const oneDayAgo = new Date(now);
    oneDayAgo.setHours(oneDayAgo.getHours() - 24);

    // Get notifications for all users
    const { data: notifications, error: notifiedError } = await supabase
      .from('notification_history')
      .select('user_id, status, retry_count, sent_at, notification_type')
      .gte('sent_at', oneDayAgo.toISOString())
      .order('sent_at', { ascending: false }); // Get latest attempt

    if (notifiedError) {
      console.error('Error fetching notification history:', {
        error: notifiedError,
        details: notifiedError.message
      });
      throw notifiedError;
    }

    // Group notifications by user ID for efficient lookup
    const notificationsByUser = new Map();
    notifications?.forEach(notification => {
      const existing = notificationsByUser.get(notification.user_id) || [];
      notificationsByUser.set(notification.user_id, [...existing, notification]);
    });

    console.log('Notification history results:', {
      totalNotifications: notifications?.length || 0,
      uniqueUsers: notificationsByUser.size
    });

    console.log('Fetching push subscriptions');
    // Get users with valid FCM tokens
    const { data: subscriptions, error: subsError } = await supabase
      .from('push_subscriptions')
      .select('user_id, fcm_token')
      .not('fcm_token', 'is', null);

    if (subsError) {
      console.error('Error fetching push subscriptions:', {
        error: subsError,
        details: subsError.message
      });
      throw subsError;
    }

    if (!subscriptions?.length) {
      console.log('No subscribed users found');
      return new Response(
        JSON.stringify([]),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log('Push subscription results:', {
      totalSubscriptions: subscriptions.length
    });

    console.log('Fetching user preferences');
    // Get user preferences
    const { data: preferences, error: prefError } = await supabase
      .from('user_preferences')
      .select('user_id, timezone')
      .in('user_id', subscriptions.map(s => s.user_id));

    if (prefError) {
      console.error('Error fetching user preferences:', {
        error: prefError,
        details: prefError.message
      });
      throw prefError;
    }

    console.log('User preferences results:', {
      totalPreferences: preferences?.length || 0,
      timezones: [...new Set(preferences?.map(p => p.timezone) || [])]
    });

    // Create map of user preferences for efficient lookup
    const preferenceMap = new Map(
      preferences?.map(p => [p.user_id, p.timezone]) || []
    );

    console.log('Processing time windows', {
      currentTime: now.toISOString(),
      buffer: WINDOW_BUFFER_HOURS
    });

    // Filter users who:
    // 1. Haven't been successfully notified today or haven't reached max retries (3 attempts)
    // 2. Are in their notification window
    // 3. Have due reminders (only required for afternoon/evening windows)
    const dueRemindersMap = new Map<string, number>();
    
    // Only fetch due reminders if we're in a window that requires them
    const currentWindows = NOTIFICATION_WINDOWS.filter(w => {
      const userTime = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
      const currentHour = userTime.getHours();
      const hourDiff = (currentHour - w.hour + 24) % 24;
      return hourDiff <= WINDOW_BUFFER_HOURS;
    });
    
    if (currentWindows.some(w => w.requiresDueReminders)) {
      console.log('Fetching due reminders for users');
      // Get start of day in UTC since due_date is stored in UTC
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);

      const { data: dueReminders, error: remindersError } = await supabase
        .from('reminders')
        .select('user_id')
        .eq('completed', false)
        .lte('due_date', today.toISOString());

      if (remindersError) {
        console.error('Error fetching due reminders:', {
          error: remindersError,
          details: remindersError.message
        });
        throw remindersError;
      }

      // Count due reminders per user
      dueReminders?.forEach(reminder => {
        dueRemindersMap.set(
          reminder.user_id,
          (dueRemindersMap.get(reminder.user_id) || 0) + 1
        );
      });

      console.log('Due reminders found:', {
        usersWithDue: dueRemindersMap.size,
        totalDue: dueReminders?.length || 0
      });
    }

    const eligibleUsers = subscriptions.reduce<Array<{userId: string, windowType: NotificationType}>>((acc, sub) => {
      const timezone = preferenceMap.get(sub.user_id) || 'UTC';
      const userTime = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
      
      // Get start of day in user's timezone
      const userTodayStart = new Date(userTime);
      userTodayStart.setHours(0, 0, 0, 0);
      
      // Check notifications for this user
      const userNotifications = notificationsByUser.get(sub.user_id) || [];
      
      // Find appropriate notification window
      const currentWindow = NOTIFICATION_WINDOWS.find(w => {
        const hourDiff = (userTime.getHours() - w.hour + 24) % 24;
        return hourDiff <= WINDOW_BUFFER_HOURS;
      });

      if (!currentWindow) {
        return acc; // No current window
      }

      // Find notifications from today in user's timezone for the current window type
      const todayWindowNotifications = userNotifications.filter(notification => {
        const notificationTime = new Date(notification.sent_at);
        const userNotificationTime = new Date(notificationTime.toLocaleString('en-US', { timeZone: timezone }));
        return userNotificationTime >= userTodayStart &&
               notification.notification_type === currentWindow.type;
      });

      // Check if user has successful notification today for this window or hit retry limit
      const hasSuccessForWindow = todayWindowNotifications.some(n => n.status === 'success');
      const hasMaxRetriesForWindow = todayWindowNotifications.some(n => n.retry_count >= 2);

      if (hasSuccessForWindow || hasMaxRetriesForWindow) {
        return acc;
      }

      // For windows requiring due reminders, check if user has any
      if (currentWindow.requiresDueReminders) {
        const dueCount = dueRemindersMap.get(sub.user_id) || 0;
        if (dueCount === 0) {
          return acc; // Skip users with no due reminders for afternoon/evening windows
        }
      }
      const currentHour = userTime.getHours();

      // Find appropriate notification window
      const userWindow = NOTIFICATION_WINDOWS.find(w => {
        const hourDiff = (currentHour - w.hour + 24) % 24;
        return hourDiff <= WINDOW_BUFFER_HOURS;
      });

      if (userWindow) {
        // For windows requiring due reminders, check if user has any
        if (userWindow.requiresDueReminders) {
          const dueCount = dueRemindersMap.get(sub.user_id) || 0;
          if (dueCount === 0) {
            return acc; // Skip users with no due reminders for afternoon/evening windows
          }
        }

        acc.push({
          userId: sub.user_id,
          windowType: userWindow.type
        });
      }

      return acc;
    }, []);

    // Group notifications by window type for logging
    const notificationsByWindow = new Map<NotificationType, typeof notifications>();
    NOTIFICATION_WINDOWS.forEach(w => {
      notificationsByWindow.set(w.type, notifications?.filter(n => n.notification_type === w.type) || []);
    });

    console.log('Eligibility check completed:', {
      totalEligible: eligibleUsers.length,
      currentWindows: currentWindows.map(w => ({
        type: w.type,
        stats: {
          total: notificationsByWindow.get(w.type)?.length || 0,
          success: notificationsByWindow.get(w.type)?.filter(n => n.status === 'success').length || 0,
          maxRetries: notificationsByWindow.get(w.type)?.filter(n => n.retry_count >= 2).length || 0
        }
      })),
      skippedUsers: {
        noDueReminders: currentWindows.some(w => w.requiresDueReminders) ?
          subscriptions.length - eligibleUsers.length -
          currentWindows.reduce((acc, w) => {
            const windowNotifications = notificationsByWindow.get(w.type) || [];
            return acc + windowNotifications.filter(n =>
              n.status === 'success' || n.retry_count >= 2
            ).length;
          }, 0) : 0
      },
      timezones: [...new Set(eligibleUsers.map(u => preferenceMap.get(u.userId) || 'UTC'))]
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
    console.error('Error in users function:', {
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