import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as webPush from "https://esm.sh/v128/web-push@3.6.1?target=denonext&deno-std=0.168.0";

const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY');
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

type NotificationType = 'morning' | 'afternoon' | 'evening';

interface NotificationWindow {
  type: NotificationType;
  hour: number;
  requiresDueReminders: boolean;
}

const NOTIFICATION_WINDOWS: NotificationWindow[] = [
  { type: 'morning', hour: 9, requiresDueReminders: false },
  { type: 'afternoon', hour: 14, requiresDueReminders: true },
  { type: 'evening', hour: 19, requiresDueReminders: true }
];

async function getDueRemindersCount(userId: string): Promise<number> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { data: reminders, error } = await supabase
    .from('reminders')
    .select('id')
    .eq('user_id', userId)
    .eq('completed', false)
    .lte('due_date', today.toISOString());

  if (error) {
    console.error('Error fetching reminders:', error);
    return 0;
  }

  return reminders?.length || 0;
}

async function getUserTimeAndSubscription(userId: string) {
  console.log(`Fetching data for user ${userId}`);

  // Get user preferences which includes timezone
  const { data: prefs, error: prefsError } = await supabase
    .from('user_preferences')
    .select('timezone')
    .eq('user_id', userId)
    .single();

  if (prefsError) {
    console.error('Error fetching user preferences:', prefsError);
    console.log('Using default timezone (UTC)');
  }

  // Get push subscription
  const { data: subscription, error: subError } = await supabase
    .from('push_subscriptions')
    .select('subscription')
    .eq('user_id', userId)
    .single();

  if (subError) {
    console.error('Error fetching subscription:', subError);
    throw new Error('Error fetching subscription');
  }

  if (!subscription) {
    throw new Error('No subscription found');
  }

  const result = {
    timezone: prefs?.timezone || 'UTC',
    username: 'User',  // Generic username is fine since we don't use it for critical functionality
    subscription: subscription.subscription
  };

  console.log('User data retrieved:', {
    userId,
    timezone: result.timezone,
    hasSubscription: !!result.subscription
  });

  return result;
}

async function getLastNotificationTime(userId: string, type: NotificationType): Promise<Date | null> {
  const { data, error } = await supabase
    .from('notification_history')
    .select('sent_at')
    .eq('user_id', userId)
    .eq('notification_type', type)
    .order('sent_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    return null;
  }

  return new Date(data.sent_at);
}

async function recordNotification(userId: string, type: NotificationType): Promise<void> {
  const { error } = await supabase
    .from('notification_history')
    .insert({
      user_id: userId,
      notification_type: type,
      sent_at: new Date().toISOString()
    });

  if (error) {
    console.error('Error recording notification:', error);
  }
}

function getCurrentWindow(hour: number): NotificationWindow | null {
  // Check current hour's window
  const currentWindow = NOTIFICATION_WINDOWS.find(w => w.hour === hour);
  if (currentWindow) {
    return currentWindow;
  }

  // Find the most recent passed window
  const passedWindows = NOTIFICATION_WINDOWS
    .filter(w => w.hour < hour)
    .sort((a, b) => b.hour - a.hour);
  
  if (passedWindows.length > 0) {
    return passedWindows[0];
  }

  // If no windows have passed today, return the last window from yesterday
  if (hour < NOTIFICATION_WINDOWS[0].hour) {
    return NOTIFICATION_WINDOWS[NOTIFICATION_WINDOWS.length - 1];
  }

  return null;
}

async function shouldNotify(
  userId: string,
  window: NotificationWindow,
  userTime: Date,
  dueCount: number
): Promise<boolean> {
  // Get the last notification time for this window type
  const lastNotification = await getLastNotificationTime(userId, window.type);
  console.log(`Last notification for user ${userId}, window ${window.type}: ${lastNotification?.toISOString() || 'none'}`);

  if (!lastNotification) {
    console.log(`No previous notification found for window ${window.type}, should notify`);
    return true;
  }

  // Convert both dates to user's timezone for comparison
  const lastNotificationDay = lastNotification.getDate();
  const currentDay = userTime.getDate();

  console.log(`Comparing days - Last notification: ${lastNotificationDay}, Current: ${currentDay}`);
  console.log(`Window requires due reminders: ${window.requiresDueReminders}, Due count: ${dueCount}`);

  // If it's a different day and either:
  // 1. It's not requiring due reminders, or
  // 2. It is requiring due reminders and there are some
  const should = lastNotificationDay !== currentDay &&
         (!window.requiresDueReminders || (window.requiresDueReminders && dueCount > 0));

  console.log(`Should notify for window ${window.type}: ${should}`);
  return should;
}

serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response('ok', {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    if (!VAPID_PRIVATE_KEY || !VAPID_PUBLIC_KEY) {
      throw new Error('Missing VAPID keys');
    }

    const { userId } = await req.json();

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'Missing user ID' }),
        { status: 400 }
      );
    }

    const { timezone, username, subscription } = await getUserTimeAndSubscription(userId);
    const userTime = new Date(new Date().toLocaleString('en-US', { timeZone: timezone }));
    const currentHour = userTime.getHours();
    
    console.log(`Processing notification for user ${userId} - Time in ${timezone}: ${userTime.toISOString()} (Hour: ${currentHour})`);
    
    // Find current notification window
    const currentWindow = getCurrentWindow(currentHour);
    console.log(`Current window: ${currentWindow ? currentWindow.type : 'none'} (searching for hour ${currentHour})`);

    if (!currentWindow) {
      return new Response(
        JSON.stringify({
          message: 'No notification window available',
          debug: {
            timezone,
            userTime: userTime.toISOString(),
            currentHour
          }
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    const dueCount = await getDueRemindersCount(userId);
    
    // Check if we should send a notification
    const shouldSendNotification = await shouldNotify(userId, currentWindow, userTime, dueCount);
    
    if (!shouldSendNotification) {
      return new Response(
        JSON.stringify({ message: 'Notification already sent for this window' }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    try {
      console.log('Setting VAPID details with subscription:', {
        endpoint: subscription.endpoint,
        keys: !!subscription.keys,
        vapidKeyExists: !!VAPID_PUBLIC_KEY
      });

      try {
        await webPush.setVapidDetails(
          'mailto:admin@touchbase.com',
          VAPID_PUBLIC_KEY,
          VAPID_PRIVATE_KEY
        );
        console.log('VAPID details set successfully');
      } catch (vapidError) {
        console.error('VAPID setup error:', {
          error: vapidError,
          stack: vapidError.stack,
          message: vapidError.message
        });
        throw vapidError;
      }

      const notificationPayload = {
        title: 'TouchBase Reminder',
        body: `Hi ${username}, you have ${dueCount} interaction${dueCount === 1 ? '' : 's'} due today! Update here if done.`,
        url: '/reminders'
      };

      console.log('Attempting to send notification...');
      console.log('Subscription format:', {
        endpoint: subscription.endpoint,
        keys: Object.keys(subscription.keys || {}),
        expirationTime: subscription.expirationTime
      });

      if (subscription) {
        try {
          const serializedPayload = JSON.stringify(notificationPayload);
          console.log('Sending notification with payload:', serializedPayload);
          
          await webPush.sendNotification(
            subscription,
            serializedPayload
          );
          console.log('Push notification sent successfully');
          
          // Record the notification
          await recordNotification(userId, currentWindow.type);
          console.log('Notification recorded in history');
        } catch (pushError) {
          console.error('Send notification error:', {
            error: pushError,
            stack: pushError.stack,
            message: pushError.message,
            name: pushError.name
          });
          throw pushError;
        }
      }
    } catch (err) {
      console.error('Web Push overall error:', {
        error: err,
        stack: err.stack,
        message: err.message,
        name: err.name
      });
      throw new Error(`Failed to send push notification: ${err.message}`);
    }

    return new Response(
      JSON.stringify({ 
        message: 'Notification sent successfully',
        window: currentWindow.type
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Push notification error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500 }
    );
  }
});