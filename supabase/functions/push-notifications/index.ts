import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const FIREBASE_PROJECT_ID = Deno.env.get('VITE_FIREBASE_PROJECT_ID');
const FIREBASE_PRIVATE_KEY = Deno.env.get('VITE_FIREBASE_PRIVATE_KEY')?.replace(/\\n/g, '\n');
const FIREBASE_CLIENT_EMAIL = Deno.env.get('VITE_FIREBASE_CLIENT_EMAIL');

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing Supabase environment variables');
}

if (!FIREBASE_PROJECT_ID || !FIREBASE_PRIVATE_KEY || !FIREBASE_CLIENT_EMAIL) {
  throw new Error('Missing Firebase environment variables');
}

// Base64Url encoding function
function base64UrlEncode(input: string): string {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const base64 = btoa(String.fromCharCode(...data));
  return base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// FCM OAuth token management
async function getFcmAccessToken(): Promise<string> {
  console.log('Starting JWT token generation...');
  const now = Math.floor(Date.now() / 1000);
  const header = {
    alg: 'RS256',
    typ: 'JWT'
  };
  console.log('JWT header:', header);

  const payload = {
    iss: FIREBASE_CLIENT_EMAIL,
    sub: FIREBASE_CLIENT_EMAIL,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
    scope: 'https://www.googleapis.com/auth/firebase.messaging'
  };
  console.log('JWT payload:', { ...payload, exp_in: payload.exp - now });

  const encoder = new TextEncoder();
  const privateKey = await crypto.subtle.importKey(
    'pkcs8',
    new Uint8Array(atob(FIREBASE_PRIVATE_KEY.replace(/-----BEGIN PRIVATE KEY-----|\n|-----END PRIVATE KEY-----/g, '')).split('').map(c => c.charCodeAt(0))),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  try {
    console.log('Creating JWT segments...');
    // Create JWT segments
    const headerEncoded = base64UrlEncode(JSON.stringify(header));
    const payloadEncoded = base64UrlEncode(JSON.stringify(payload));
    const toSign = `${headerEncoded}.${payloadEncoded}`;
    console.log('JWT segments created:', { headerEncoded, payloadEncoded });

    console.log('Signing JWT...');
    // Sign the JWT
    const signature = await crypto.subtle.sign(
      { name: 'RSASSA-PKCS1-v1_5' },
      privateKey,
      encoder.encode(toSign)
    );

    console.log('Converting signature to base64url...');
    // Convert signature to base64url - handle binary data differently
    const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    
    const jwt = `${headerEncoded}.${payloadEncoded}.${signatureBase64}`;
    console.log('JWT created successfully');
  } catch (error) {
    console.error('Error in JWT generation:', {
      error,
      message: error.message,
      stack: error.stack,
      phase: 'JWT creation'
    });
    throw new Error(`JWT generation failed: ${error.message}`);
  }

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt
    })
  });

  const data = await response.json();
  return data.access_token;
}

// FCM notification sender
async function sendFcmNotification(fcmToken: string, title: string, body: string, url: string): Promise<void> {
  const accessToken = await getFcmAccessToken();
  
  const response = await fetch(
    `https://fcm.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/messages:send`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          token: fcmToken,
          notification: {
            title,
            body
          },
          webpush: {
            fcm_options: {
              link: url
            }
          }
        }
      })
    }
  );

  if (!response.ok) {
    const error = await response.json();
    console.error('FCM API error:', error);
    throw new Error(`FCM API error: ${error.error.message}`);
  }
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function addCorsHeaders(headers: Headers = new Headers()) {
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  headers.set('Access-Control-Max-Age', '86400');
  headers.set('Access-Control-Allow-Credentials', 'true');
  return headers;
}

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

  // Get FCM token
  const { data: subscription, error: subError } = await supabase
    .from('push_subscriptions')
    .select('fcm_token')
    .eq('user_id', userId)
    .single();

  if (subError) {
    console.error('Error fetching FCM token:', subError);
    throw new Error('Error fetching FCM token');
  }

  if (!subscription?.fcm_token) {
    throw new Error('No FCM token found');
  }

  const result = {
    timezone: prefs?.timezone || 'UTC',
    username: 'User',  // Generic username is fine since we don't use it for critical functionality
    fcmToken: subscription.fcm_token
  };

  console.log('User data retrieved:', {
    userId,
    timezone: result.timezone,
    hasFcmToken: !!result.fcmToken
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

      const { timezone, username, fcmToken } = await getUserTimeAndSubscription(userId);

      try {
        await sendFcmNotification(
          fcmToken,
          'Test Notification',
          message || 'This is a test notification',
          '/reminders'
        );

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
        { status: 400 }
      );
    }

    const { timezone, username, fcmToken } = await getUserTimeAndSubscription(userId);
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
        { headers: addCorsHeaders(new Headers({ 'Content-Type': 'application/json' })) }
      );
    }

    const dueCount = await getDueRemindersCount(userId);
    
    // Check if we should send a notification
    const shouldSendNotification = await shouldNotify(userId, currentWindow, userTime, dueCount);
    
    if (!shouldSendNotification) {
      return new Response(
        JSON.stringify({ message: 'Notification already sent for this window' }),
        { headers: addCorsHeaders(new Headers({ 'Content-Type': 'application/json' })) }
      );
    }

    try {
      const title = 'TouchBase Reminder';
      const body = `Hi ${username}, you have ${dueCount} interaction${dueCount === 1 ? '' : 's'} due today! Update here if done.`;
      const url = '/reminders';

      console.log('Attempting to send FCM notification...');
      
      try {
        await sendFcmNotification(fcmToken, title, body, url);
        
        // Record the notification
        await recordNotification(userId, currentWindow.type);
        console.log('Notification recorded in history');
      } catch (pushError: any) {
        console.error('Send notification error:', pushError);

        // If token is expired/invalid, delete it
        if (pushError.message.includes('registration-token-not-registered')) {
          console.log('FCM token invalid, deleting...');
          const { error: deleteError } = await supabase
            .from('push_subscriptions')
            .delete()
            .eq('user_id', userId);

          if (deleteError) {
            console.error('Error deleting invalid FCM token:', deleteError);
          } else {
            console.log('Invalid FCM token deleted successfully');
          }

          throw new Error('FCM token invalid - resubscription required');
        }

        throw pushError;
      }
    } catch (err) {
      console.error('FCM notification error:', {
        error: err,
        stack: err.stack,
        message: err.message,
        name: err.name
      });
      throw new Error(`Failed to send FCM notification: ${err.message}`);
    }

    return new Response(
      JSON.stringify({ 
        message: 'Notification sent successfully',
        window: currentWindow.type
      }),
      { headers: addCorsHeaders(new Headers({ 'Content-Type': 'application/json' })) }
    );
  } catch (error) {
    console.error('Push notification error:', {
      error: error,
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    
    // Log the error chain if it exists
    let currentError = error;
    while (currentError.cause) {
      console.error('Caused by:', {
        error: currentError.cause,
        message: currentError.cause.message,
        stack: currentError.cause.stack
      });
      currentError = currentError.cause;
    }

    return new Response(
      JSON.stringify({
        error: error.message,
        details: error.stack,
        name: error.name
      }),
      { status: 500, headers: addCorsHeaders(new Headers({ 'Content-Type': 'application/json' })) }
    );
  }
});