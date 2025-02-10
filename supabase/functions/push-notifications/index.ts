import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const FIREBASE_PROJECT_ID = Deno.env.get('VITE_FIREBASE_PROJECT_ID');
const FIREBASE_PRIVATE_KEY = Deno.env.get('VITE_FIREBASE_PRIVATE_KEY');
const FIREBASE_CLIENT_EMAIL = Deno.env.get('VITE_FIREBASE_CLIENT_EMAIL');

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing Supabase environment variables');
}

if (!FIREBASE_PROJECT_ID || !FIREBASE_PRIVATE_KEY || !FIREBASE_CLIENT_EMAIL) {
  throw new Error('Missing Firebase environment variables');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

type NotificationType = 'morning' | 'afternoon' | 'evening';
type NotificationStatus = 'success' | 'error' | 'invalid_token';

function logStep(step: string, data?: any) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${step}`);
  if (data) {
    console.log(`[${timestamp}] Data:`, JSON.stringify(data, null, 2));
  }
}

async function getFcmAccessToken(): Promise<string> {
  logStep('Getting FCM access token');
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: FIREBASE_CLIENT_EMAIL,
    sub: FIREBASE_CLIENT_EMAIL,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
    scope: 'https://www.googleapis.com/auth/firebase.messaging'
  };

  try {
    const encode = (obj: any) => btoa(JSON.stringify(obj));
    const message = `${encode(header)}.${encode(payload)}`;

    const cleanedKey = FIREBASE_PRIVATE_KEY
      .replace(/^"/, '')
      .replace(/"$/, '')
      .replace(/\\n/g, '\n');

    const base64Key = cleanedKey
      .replace('-----BEGIN PRIVATE KEY-----\n', '')
      .replace('\n-----END PRIVATE KEY-----', '')
      .replace(/\n/g, '');

    const signature = new Uint8Array(await crypto.subtle.sign(
      { name: 'RSASSA-PKCS1-v1_5' },
      await crypto.subtle.importKey(
        'pkcs8',
        new Uint8Array(atob(base64Key).split('').map(c => c.charCodeAt(0))),
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        false,
        ['sign']
      ),
      new TextEncoder().encode(message)
    ));

    const jwt = `${message}.${btoa(String.fromCharCode(...signature))}`;
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt
      })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(`OAuth token request failed: ${data.error_description || data.error || 'Unknown error'}`);
    }

    logStep('FCM token acquired successfully');
    return data.access_token;
  } catch (error) {
    logStep('FCM token error', error);
    throw error;
  }
}

async function recordNotificationAttempt(
  userId: string,
  windowType: NotificationType,
  status: NotificationStatus,
  error?: string,
  batchId?: string
): Promise<void> {
  try {
    logStep('Recording notification attempt', { userId, windowType, status, error, batchId });
    
    const { error: dbError } = await supabase
      .from('notification_history')
      .insert({
        user_id: userId,
        notification_type: windowType,
        sent_at: new Date().toISOString(),
        status: status,
        error_message: error,
        batch_id: batchId
      });

    if (dbError) {
      logStep('Error recording notification attempt', dbError);
    } else {
      logStep('Notification attempt recorded successfully');
    }
  } catch (err) {
    logStep('Failed to record notification attempt', err);
  }
}

async function sendFcmNotification(
  userId: string,
  fcmToken: string,
  title: string,
  body: string,
  url: string,
  windowType: NotificationType,
  batchId?: string
): Promise<void> {
  logStep('Sending FCM notification', { userId, windowType, title });
  
  try {
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
            notification: { title, body },
            webpush: {
              notification: {
                title,
                body,
                icon: '/icon-192.png',
                badge: '/icon-192.png',
                requireInteraction: true,
                tag: 'touchbase-notification',
                renotify: true,
                actions: [
                  {
                    action: 'view',
                    title: 'View'
                  }
                ]
              },
              fcm_options: { link: url }
            }
          }
        })
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`FCM API error: ${error.error.message}`);
    }

    logStep('FCM notification sent successfully', { userId });
    await recordNotificationAttempt(userId, windowType, 'success', undefined, batchId);

  } catch (error) {
    if (error.message.includes('registration-token-not-registered')) {
      logStep('Invalid FCM token, removing subscription', { userId });
      await Promise.all([
        recordNotificationAttempt(userId, windowType, 'invalid_token', error.message, batchId),
        supabase
          .from('push_subscriptions')
          .delete()
          .eq('user_id', userId)
      ]);
      throw new Error('FCM token invalid - resubscription required');
    }

    logStep('Error sending FCM notification', { userId, error });
    await recordNotificationAttempt(userId, windowType, 'error', error.message, batchId);
    throw error;
  }
}

async function getUserData(userId: string): Promise<{ username: string; fcmToken: string }> {
  logStep('Getting user data', { userId });
  
  const [userData, subscription] = await Promise.all([
    supabase.auth.admin.getUserById(userId),
    supabase
      .from('push_subscriptions')
      .select('fcm_token')
      .eq('user_id', userId)
      .maybeSingle()
  ]);

  const username = userData.data?.user?.user_metadata?.name || 'Friend';
  
  if (!subscription?.data?.fcm_token) {
    logStep('No FCM token found', { userId });
    throw new Error(`No FCM token found for user: ${userId}`);
  }

  logStep('User data retrieved', { userId, hasToken: true });
  return {
    username,
    fcmToken: subscription.data.fcm_token
  };
}

async function getDueRemindersCount(userId: string): Promise<number> {
  logStep('Getting due reminders count', { userId });
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { data: reminders, error } = await supabase
    .from('reminders')
    .select('id')
    .eq('user_id', userId)
    .eq('completed', false)
    .lte('due_date', today.toISOString());

  if (error) {
    logStep('Error fetching reminders', { userId, error });
    return 0;
  }

  logStep('Due reminders count retrieved', { userId, count: reminders?.length || 0 });
  return reminders?.length || 0;
}

serve(async (req) => {
  const batchId = crypto.randomUUID();
  logStep('Starting push notification request', { batchId });
  
  try {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: addCorsHeaders() });
    }

    const url = new URL(req.url);
    // Handle test notifications
    if (url.pathname.endsWith('/test')) {
      const { userId, message } = await req.json();
      logStep('Processing test notification', { userId });
      
      if (!userId) {
        return new Response(
          JSON.stringify({ error: 'Missing user ID' }),
          { 
            status: 400,
            headers: addCorsHeaders(new Headers({ 'Content-Type': 'application/json' }))
          }
        );
      }

      const { username, fcmToken } = await getUserData(userId);
      await sendFcmNotification(
        userId,
        fcmToken,
        'Test Notification',
        message || 'This is a test notification',
        '/reminders',
        'morning',
        batchId
      );

      logStep('Test notification completed', { userId });
      return new Response(
        JSON.stringify({ 
          message: 'Test notification sent successfully',
          batchId
        }),
        { headers: addCorsHeaders(new Headers({ 'Content-Type': 'application/json' })) }
      );
    }

    // Handle regular notifications
    const { userId, windowType } = await req.json();
    logStep('Processing notification request', { userId, windowType });
    
    if (!userId || !windowType) {
      return new Response(
        JSON.stringify({ error: 'Missing user ID or window type' }),
        { 
          status: 400,
          headers: addCorsHeaders(new Headers({ 'Content-Type': 'application/json' }))
        }
      );
    }

    // Get user data and due reminders count in parallel
    const [{ username, fcmToken }, dueCount] = await Promise.all([
      getUserData(userId),
      getDueRemindersCount(userId)
    ]);

    // Send notification
    const title = 'TouchBase Reminder';
    const body = `Hi ${username}, you have ${dueCount} interaction${dueCount === 1 ? '' : 's'} due today! Update here if done.`;
    
    await sendFcmNotification(
      userId,
      fcmToken,
      title,
      body,
      '/reminders',
      windowType as NotificationType,
      batchId
    );

    logStep('Notification processing completed', { userId, windowType });
    return new Response(
      JSON.stringify({ 
        message: 'Notification sent successfully',
        batchId,
        window: windowType
      }),
      { headers: addCorsHeaders(new Headers({ 'Content-Type': 'application/json' })) }
    );
  } catch (error) {
    logStep('Push notification error', {
      error: error.message,
      name: error.name,
      batchId
    });
    
    return new Response(
      JSON.stringify({
        error: error.message,
        name: error.name,
        batchId
      }),
      { 
        status: 500,
        headers: addCorsHeaders(new Headers({ 'Content-Type': 'application/json' }))
      }
    );
  }
});

function addCorsHeaders(headers: Headers = new Headers()) {
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  headers.set('Access-Control-Max-Age', '86400');
  headers.set('Access-Control-Allow-Credentials', 'true');
  return headers;
}