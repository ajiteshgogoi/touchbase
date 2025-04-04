/**
 * Push Notification Service
 * 
 * Handles sending notifications to users through Firebase Cloud Messaging (FCM).
 * Records notification attempts in notification_history with batch tracking.
 * 
 * Schema alignment:
 * - Uses batch_id (uuid) from notification_history table
 * - Records notification status and retry counts
 * - Handles multiple notification windows (morning/afternoon/evening)
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createResponse, handleOptions } from '../_shared/headers.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const FIREBASE_PROJECT_ID = Deno.env.get('VITE_FIREBASE_PROJECT_ID');
const FIREBASE_PRIVATE_KEY = Deno.env.get('VITE_FIREBASE_PRIVATE_KEY');
const FIREBASE_CLIENT_EMAIL = Deno.env.get('VITE_FIREBASE_CLIENT_EMAIL');

// Notification window configuration
const NOTIFICATION_WINDOWS = [
  { type: 'morning' as const, hour: 9 },
  { type: 'afternoon' as const, hour: 14 },
  { type: 'evening' as const, hour: 19 }
];

// Window buffer in hours
const WINDOW_BUFFER_HOURS = 2;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing Supabase environment variables');
}

if (!FIREBASE_PROJECT_ID || !FIREBASE_PRIVATE_KEY || !FIREBASE_CLIENT_EMAIL) {
  throw new Error('Missing Firebase environment variables');
}

console.log('Firebase configuration:', {
  projectId: FIREBASE_PROJECT_ID,
  hasPrivateKey: !!FIREBASE_PRIVATE_KEY,
  hasClientEmail: !!FIREBASE_CLIENT_EMAIL
});

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

type NotificationType = 'morning' | 'afternoon' | 'evening';
type NotificationStatus = 'success' | 'error' | 'invalid_token';

async function getFcmAccessToken(): Promise<string> {
  console.log('Getting FCM access token');
  const now = Math.floor(Date.now() / 1000);

  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: await createJWT(now)
      })
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('FCM token error:', {
        status: response.status,
        error: data.error_description || data.error || 'Unknown error'
      });
      throw new Error(`OAuth token request failed: ${data.error_description || data.error || 'Unknown error'}`);
    }

    console.log('FCM token response:', {
      status: response.status,
      tokenType: data.token_type,
      expiresIn: data.expires_in,
      scope: data.scope
    });
    return data.access_token;
  } catch (error) {
    console.error('FCM token error:', error);
    throw error;
  }
}

async function recordNotificationAttempt(
  userId: string,
  windowType: NotificationType,
  status: NotificationStatus,
  error?: string,
  batchId?: string,
  prevAttempt?: { id: number; retry_count: number }
): Promise<void> {
  if (!batchId) {
    throw new Error('Missing batch ID for notification attempt');
  }

  try {
    console.log('Recording notification attempt:', {
      userId,
      windowType,
      status,
      batchId,
      retryCount: prevAttempt ? prevAttempt.retry_count + 1 : 0
    });

    if (prevAttempt) {
      // Update existing attempt with incremented retry count
      const { error: dbError } = await supabase
        .from('notification_history')
        .update({
          status: status,
          error_message: error,
          retry_count: prevAttempt.retry_count + 1,
          batch_id: batchId // Ensure batch_id is set on update
        })
        .eq('id', prevAttempt.id);

      if (dbError) {
        console.error('Error updating notification attempt:', {
          error: dbError,
          details: dbError.message
        });
      } else {
        console.log('Notification attempt updated successfully');
      }
    } else {
      // Create new attempt
      const { error: dbError } = await supabase
        .from('notification_history')
        .insert({
          user_id: userId,
          notification_type: windowType,
          sent_at: new Date().toISOString(),
          status: status,
          error_message: error,
          batch_id: batchId,
          retry_count: 0
        });

      if (dbError) {
        console.error('Error recording notification attempt:', {
          error: dbError,
          details: dbError.message
        });
      } else {
        console.log('Notification attempt recorded successfully');
      }
    }
  } catch (err) {
    console.error('Failed to record notification attempt:', err);
  }
}

// Helper function to send notification to a single device
async function sendSingleNotification(
  userId: string,
  device: { fcmToken: string; deviceId: string },
  title: string,
  body: string,
  url: string,
  accessToken: string
): Promise<void> {
  try {
    const response = await fetch(
      `https://fcm.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID.replaceAll(':', '%3A')}/messages:send`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: {
            token: device.fcmToken,
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
                actions: [{ action: 'view', title: 'View' }]
              },
              fcm_options: { link: url }
            }
          }
        })
      }
    );

    const responseData = await response.json();
    if (!response.ok) {
      throw new Error(`FCM API error: ${responseData.error?.message || JSON.stringify(responseData)}`);
    }

    console.log('FCM notification sent successfully to device:', { userId, deviceId: device.deviceId });
  } catch (error) {
    if (error.message.includes('registration-token-not-registered')) {
      console.log('Invalid FCM token, removing device subscription:', { userId, deviceId: device.deviceId });
      await supabase
        .from('push_subscriptions')
        .delete()
        .match({ user_id: userId, device_id: device.deviceId });
    }
    throw error;
  }
}

async function sendFcmNotification(
  userId: string,
  devices: { fcmToken: string; deviceId: string }[],
  title: string,
  body: string,
  url: string,
  windowType: NotificationType,
  batchId: string,
  isTest: boolean = false
): Promise<void> {
  console.log('Preparing FCM notifications:', { userId, windowType, title, deviceCount: devices.length });

  // Get user's timezone preference first
  const { data: userPref } = await supabase
    .from('user_preferences')
    .select('timezone')
    .eq('user_id', userId)
    .single();
  
  const timezone = userPref?.timezone || 'UTC';
  const now = new Date();
  
  // Get user's current time and start of day
  const userTime = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
  const userToday = new Date(userTime);
  userToday.setHours(0, 0, 0, 0);

  // Validate notification window
  const currentHour = userTime.getHours();
  const window = NOTIFICATION_WINDOWS.find(w => w.type === windowType);
  if (!window) {
    throw new Error(`Invalid window type: ${windowType}`);
  }

  // Skip window check for test notifications
  if (isTest) {
    console.log('Skipping window check for test notification');
  } else {
    const hourDiff = (currentHour - window.hour + 24) % 24;
    if (hourDiff > WINDOW_BUFFER_HOURS) {
      throw new Error(`Outside notification window for ${windowType}`);
    }
  }

  // Get all previous attempts for today
  const { data: prevAttempts } = await supabase
    .from('notification_history')
    .select('id, retry_count, sent_at, status')
    .eq('user_id', userId)
    .eq('notification_type', windowType)
    .order('sent_at', { ascending: false });

  // Filter attempts for today in user's timezone
  const todayAttempts = prevAttempts?.filter(attempt => {
    const attemptDate = new Date(attempt.sent_at);
    const userAttemptDate = new Date(attemptDate.toLocaleString('en-US', { timeZone: timezone }));
    userAttemptDate.setHours(0, 0, 0, 0);
    return userAttemptDate.getTime() === userToday.getTime();
  }) || [];

  // Skip notification checks for test notifications
  if (!isTest) {
    // Check if already successfully notified today
    if (todayAttempts.some(attempt => attempt.status === 'success')) {
      throw new Error('Already successfully notified today');
    }

    // Check retry limit (max 3 attempts)
    if (todayAttempts.length >= 3) {
      throw new Error('Maximum retry attempts reached');
    }
  } else {
    console.log('Skipping notification limit checks for test notification');
  }

  const prevAttempt = todayAttempts[0];

  try {
    const accessToken = await getFcmAccessToken();
    
    // Send to all devices
    const results = await Promise.allSettled(
      devices.map(device => sendSingleNotification(userId, device, title, body, url, accessToken))
    );

    // Check results
    const successCount = results.filter(r => r.status === 'fulfilled').length;
    const failureCount = results.filter(r => r.status === 'rejected').length;

    console.log('Notification results:', {
      userId,
      totalDevices: devices.length,
      successCount,
      failureCount
    });

    // Record final status - success if any device succeeded
    if (successCount > 0) {
      await recordNotificationAttempt(userId, windowType, 'success', undefined, batchId, prevAttempt);
    } else {
      // All devices failed
      const errors = results
        .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
        .map(r => r.reason.message)
        .join('; ');
      
      await recordNotificationAttempt(userId, windowType, 'error', errors, batchId, prevAttempt);
      throw new Error('Failed to send notifications to all devices');
    }

  } catch (error) {
    console.error('Error sending FCM notifications:', {
      userId,
      error: error.message
    });
    throw error;
  }
}

async function getUserData(userId: string): Promise<{ username: string; devices: { fcmToken: string; deviceId: string }[] }> {
  console.log('Fetching user data:', { userId });

  const [userData, subscriptions] = await Promise.all([
    supabase.auth.admin.getUserById(userId),
    supabase
      .from('push_subscriptions')
      .select('fcm_token, device_id')
      .eq('user_id', userId)
  ]);

  const username = userData.data?.user?.user_metadata?.name || 'Friend';

  if (!subscriptions?.data?.length) {
    console.error('No FCM tokens found:', { userId });
    throw new Error(`No FCM tokens found for user: ${userId}`);
  }

  console.log('User data retrieved:', {
    userId,
    hasUsername: !!username,
    deviceCount: subscriptions.data.length
  });

  return {
    username,
    devices: subscriptions.data.map(sub => ({
      fcmToken: sub.fcm_token,
      deviceId: sub.device_id
    }))
  };
}

async function getDueRemindersCount(userId: string): Promise<number> {
  console.log('Getting due reminders:', { userId });

  // First get user's timezone preference
  const { data: userPref } = await supabase
    .from('user_preferences')
    .select('timezone')
    .eq('user_id', userId)
    .single();
  
  const timezone = userPref?.timezone || 'UTC';
  const now = new Date();
  
  // Get today's start in user's timezone
  const userToday = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
  userToday.setHours(0, 0, 0, 0);

  const { data: reminders, error } = await supabase
    .from('reminders')
    .select('id, due_date')
    .eq('user_id', userId)
    .eq('completed', false);

  if (error) {
    console.error('Error fetching reminders:', {
      userId,
      error: error.message
    });
    return 0;
  }

  // Filter reminders based on user's timezone
  const dueReminders = reminders?.filter(reminder => {
    const dueDate = new Date(reminder.due_date);
    const userDueDate = new Date(dueDate.toLocaleString('en-US', { timeZone: timezone }));
    userDueDate.setHours(0, 0, 0, 0);
    return userDueDate <= userToday;
  });

  console.log('Due reminders retrieved:', {
    userId,
    timezone,
    totalReminders: reminders?.length || 0,
    dueCount: dueReminders?.length || 0
  });

  return dueReminders?.length || 0;
}

async function createJWT(now: number): Promise<string> {
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: FIREBASE_CLIENT_EMAIL,
    sub: FIREBASE_CLIENT_EMAIL,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
    scope: 'https://www.googleapis.com/auth/firebase.messaging'
  };

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

  const privateKeyData = new Uint8Array(atob(base64Key).split('').map(c => c.charCodeAt(0)));
  const privateKey = await crypto.subtle.importKey(
    'pkcs8',
    privateKeyData,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signatureBuffer = await crypto.subtle.sign(
    { name: 'RSASSA-PKCS1-v1_5' },
    privateKey,
    new TextEncoder().encode(message)
  );

  const signature = new Uint8Array(signatureBuffer);
  return `${message}.${btoa(String.fromCharCode(...signature))}`;
}

serve(async (req) => {
  let requestData;
  try {
    if (req.method === 'OPTIONS') {
      return handleOptions();
    }

    const url = new URL(req.url);
    requestData = await req.json();

    // Validate batch ID (required for base endpoint only)
    if (url.pathname === '/push-notifications' && !requestData.batchId) {
      return createResponse(
        { error: 'Missing batch ID' },
        { status: 400 }
      );
    }

    // Handle test notifications
    if (url.pathname.endsWith('/test')) {
      const { userId, message } = requestData;
      // Generate test batch ID
      const testBatchId = crypto.randomUUID();
      console.log('Processing test notification:', { userId, testBatchId });

      if (!userId) {
        return createResponse(
          { error: 'Missing user ID' },
          { status: 400 }
        );
      }

      const { username, devices } = await getUserData(userId);
      await sendFcmNotification(
        userId,
        devices,
        'Test Notification',
        message || 'This is a test notification',
        '/reminders',
        'morning',
        testBatchId,
        true
      );

      console.log('Test notification completed:', { userId, testBatchId });
      return createResponse({
        message: 'Test notification sent successfully',
        batchId: testBatchId
      });
    }

    // Handle FCM token verification
    if (url.pathname.endsWith('/verify')) {
      const { userId } = requestData;
      console.log('Verifying FCM token:', { userId });

      if (!userId) {
        return createResponse(
          { error: 'Missing user ID' },
          { status: 400 }
        );
      }

      await getUserData(userId);

      return createResponse({
        message: 'FCM token verified successfully'
      });
    }

    // Handle regular notifications (base endpoint)
    if (url.pathname === '/push-notifications') {
      const { userId, windowType, batchId } = requestData;
      console.log('Processing notification:', { userId, windowType, batchId });

      if (!userId || !windowType) {
        return createResponse(
          { error: 'Missing user ID or window type' },
          { status: 400 }
        );
      }

      // Get user data and due reminders count in parallel
      const [{ username, devices }, dueCount] = await Promise.all([
        getUserData(userId),
        getDueRemindersCount(userId)
      ]);

      // Send notification
      const title = 'TouchBase Reminder';
      const body = `Hi ${username}, you have ${dueCount} interaction${dueCount === 1 ? '' : 's'} due today! Update here if done.`;

      await sendFcmNotification(
        userId,
        devices,
        title,
        body,
        '/reminders',
        windowType as NotificationType,
        batchId
      );

      console.log('Notification processing completed:', { userId, windowType, batchId });
      return createResponse({
        message: 'Notification sent successfully',
        batchId,
        window: windowType
      });
    }

    return createResponse(
      { error: 'Invalid request' },
      { status: 400 }
    );

  } catch (error) {
    console.error('Push notification error:', {
      error: error.message,
      stack: error.stack
    });

    return createResponse(
      {
        error: error.message,
        name: error.name,
        batchId: requestData?.batchId
      },
      { status: 500 }
    );
  }
});
