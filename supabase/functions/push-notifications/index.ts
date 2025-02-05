import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webPush from "https://esm.sh/web-push@3.6.7";

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
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('timezone, username')
    .eq('id', userId)
    .single();

  if (userError) {
    throw new Error('Error fetching user data');
  }

  const { data: subscription, error: subError } = await supabase
    .from('push_subscriptions')
    .select('subscription')
    .eq('user_id', userId)
    .single();

  if (subError) {
    throw new Error('Error fetching subscription');
  }

  return {
    timezone: userData?.timezone || 'UTC',
    username: userData?.username || 'User',
    subscription: subscription?.subscription
  };
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
  if (!lastNotification) {
    return true; // No previous notification, should notify
  }

  // Convert both dates to user's timezone for comparison
  const lastNotificationDay = lastNotification.getDate();
  const currentDay = userTime.getDate();

  // If it's a different day and either:
  // 1. It's not requiring due reminders, or
  // 2. It is requiring due reminders and there are some
  return lastNotificationDay !== currentDay && 
         (!window.requiresDueReminders || (window.requiresDueReminders && dueCount > 0));
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
    
    // Find current notification window
    const currentWindow = getCurrentWindow(currentHour);
    if (!currentWindow) {
      return new Response(
        JSON.stringify({ message: 'No notification window available' }),
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

    webPush.setVapidDetails(
      'mailto:admin@touchbase.com',
      VAPID_PUBLIC_KEY,
      VAPID_PRIVATE_KEY
    );

    const notificationPayload = {
      title: 'TouchBase Reminder',
      body: `Hi ${username}, you have ${dueCount} interaction${dueCount === 1 ? '' : 's'} due today! Update here if done.`,
      url: '/reminders'
    };

    if (subscription) {
      await webPush.sendNotification(
        subscription,
        JSON.stringify(notificationPayload)
      );
      
      // Record the notification
      await recordNotification(userId, currentWindow.type);
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