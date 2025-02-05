<<<<<<< Updated upstream
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webPush from "https://esm.sh/web-push@3.6.7";
=======
import { serve } from "std/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { initializeApp, cert } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
>>>>>>> Stashed changes

const FIREBASE_SERVICE_ACCOUNT = Deno.env.get('FIREBASE_SERVICE_ACCOUNT');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !FIREBASE_SERVICE_ACCOUNT) {
  throw new Error('Missing required environment variables');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

<<<<<<< Updated upstream
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
=======
// Initialize Firebase Admin
const serviceAccount = JSON.parse(FIREBASE_SERVICE_ACCOUNT);
initializeApp({
  credential: cert(serviceAccount)
});

const messaging = getMessaging();

function addCorsHeaders(headers: Headers = new Headers()) {
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  headers.set('Access-Control-Max-Age', '86400');
  headers.set('Access-Control-Allow-Credentials', 'true');
  return headers;
}

// Extract FCM token from subscription endpoint
function getFcmToken(subscription: any) {
  const endpoint = subscription.endpoint;
  const fcmTokenMatch = endpoint.match(/\/send\/(.+)$/);
  if (!fcmTokenMatch) {
    throw new Error('Invalid FCM endpoint format');
  }
  return fcmTokenMatch[1];
>>>>>>> Stashed changes
}

serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
<<<<<<< Updated upstream
      return new Response('ok', {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
=======
      return new Response('ok', { headers: addCorsHeaders() });
    }

    const url = new URL(req.url);
    if (url.pathname.endsWith('/test')) {
      const { userId, message } = await req.json();
      
      if (!userId) {
        return new Response(
          JSON.stringify({ error: 'Missing user ID' }),
          {
            status: 400,
            headers: addCorsHeaders(new Headers({ 'Content-Type': 'application/json' }))
          }
        );
      }

      const { data: subscription, error: subError } = await supabase
        .from('push_subscriptions')
        .select('subscription')
        .eq('user_id', userId)
        .single();

      if (subError || !subscription) {
        throw new Error('No subscription found');
      }

      try {
        // Get FCM token from subscription endpoint
        const fcmToken = getFcmToken(subscription.subscription);

        // Send test notification via FCM
        const notificationPayload = {
          notification: {
            title: 'Test Notification',
            body: message || 'This is a test notification'
          },
          webpush: {
            fcmOptions: {
              link: '/reminders'
            }
          }
        };

        console.log('Sending FCM message to token:', fcmToken);
        const response = await messaging.send({
          token: fcmToken,
          ...notificationPayload
        });

        console.log('FCM response:', response);

        return new Response(
          JSON.stringify({ message: 'Test notification sent successfully' }),
          {
            headers: addCorsHeaders(new Headers({ 'Content-Type': 'application/json' }))
          }
        );
      } catch (error) {
        console.error('Test notification error:', error);
        throw error;
      }
>>>>>>> Stashed changes
    }

    const { userId } = await req.json();

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'Missing user ID' }),
        { 
          status: 400,
          headers: addCorsHeaders(new Headers({ 'Content-Type': 'application/json' }))
        }
      );
    }

    // Get user data and subscription
    const { data: userPrefs } = await supabase
      .from('user_preferences')
      .select('timezone')
      .eq('user_id', userId)
      .single();

    const { data: subscription, error: subError } = await supabase
      .from('push_subscriptions')
      .select('subscription')
      .eq('user_id', userId)
      .single();

    if (subError || !subscription) {
      throw new Error('No subscription found');
    }

    const timezone = userPrefs?.timezone || 'UTC';
    const userTime = new Date(new Date().toLocaleString('en-US', { timeZone: timezone }));
    const currentHour = userTime.getHours();
<<<<<<< Updated upstream
    
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
=======

    // Get due reminders count
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data: reminders, error: reminderError } = await supabase
      .from('reminders')
      .select('id')
      .eq('user_id', userId)
      .eq('completed', false)
      .lte('due_date', today.toISOString());

    if (reminderError) {
      throw new Error('Failed to fetch reminders');
    }

    const dueCount = reminders?.length || 0;

    try {
      // Get FCM token from subscription endpoint
      const fcmToken = getFcmToken(subscription.subscription);

      // Send notification via FCM
      const notificationPayload = {
        notification: {
          title: 'TouchBase Reminder',
          body: `You have ${dueCount} interaction${dueCount === 1 ? '' : 's'} due today! Update here if done.`
        },
        webpush: {
          fcmOptions: {
            link: '/reminders'
          }
        }
      };

      console.log('Sending FCM message to token:', fcmToken);
      const response = await messaging.send({
        token: fcmToken,
        ...notificationPayload
      });

      console.log('FCM response:', response);

      return new Response(
        JSON.stringify({ 
          message: 'Notification sent successfully',
          fcmMessageId: response
        }),
        { headers: addCorsHeaders(new Headers({ 'Content-Type': 'application/json' })) }
      );
    } catch (err) {
      console.error('Push notification error:', err);
      
      // If the token is invalid/expired, delete the subscription
      if (err.code === 'messaging/registration-token-not-registered') {
        console.log('FCM token expired, deleting subscription...');
        const { error: deleteError } = await supabase
          .from('push_subscriptions')
          .delete()
          .eq('user_id', userId);

        if (deleteError) {
          console.error('Error deleting expired subscription:', deleteError);
        }
        throw new Error('Push subscription expired - resubscription required');
      }

      throw err;
    }
>>>>>>> Stashed changes
  } catch (error) {
    console.error('Push notification error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
<<<<<<< Updated upstream
      { status: 500 }
=======
      { 
        status: 500,
        headers: addCorsHeaders(new Headers({ 'Content-Type': 'application/json' }))
      }
>>>>>>> Stashed changes
    );
  }
});