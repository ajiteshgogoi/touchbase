import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { initializeApp, cert } from "firebase/app";
import { getMessaging } from "firebase/messaging";

const FIREBASE_SERVICE_ACCOUNT = Deno.env.get('FIREBASE_SERVICE_ACCOUNT');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !FIREBASE_SERVICE_ACCOUNT) {
  throw new Error('Missing required environment variables');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

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
}

serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
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
  } catch (error) {
    console.error('Push notification error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: addCorsHeaders(new Headers({ 'Content-Type': 'application/json' }))
      }
    );
  }
});