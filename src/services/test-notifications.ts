import { supabase } from '../lib/supabase/client';

/**
 * Get Firebase Cloud Messaging access token
 * This is only used for test notifications since production uses edge functions
 */
async function getFcmAccessToken(): Promise<string> {
  // Get required credentials
  const privateKey = import.meta.env.VITE_FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const clientEmail = import.meta.env.VITE_FIREBASE_CLIENT_EMAIL;
  
  if (!privateKey || !clientEmail) {
    throw new Error('Firebase credentials not configured');
  }

  // Create JWT header and payload
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: clientEmail,
    sub: clientEmail,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
    scope: 'https://www.googleapis.com/auth/firebase.messaging'
  };

  // Sign JWT using the private key
  const key = await crypto.subtle.importKey(
    'pkcs8',
    new Uint8Array(atob(privateKey.replace(/-----[^-]*-----/g, '')).split('').map(c => c.charCodeAt(0))),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const encodedPayload = btoa(JSON.stringify(payload));
  const message = `${header}.${encodedPayload}`;
  const signature = btoa(String.fromCharCode(...new Uint8Array(
    await crypto.subtle.sign(
      'RSASSA-PKCS1-v1_5',
      key,
      new TextEncoder().encode(message)
    )
  )));

  // Get OAuth token using the signed JWT
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${message}.${signature}`
    })
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(`OAuth token request failed: ${data.error_description || data.error || 'Unknown error'}`);
  }

  return data.access_token;
}

/**
 * Send a test notification via Firebase Cloud Messaging REST API
 * This is separate from production notifications which use edge functions
 */
export async function sendTestNotification(userId: string, message?: string): Promise<void> {
  console.log('Starting test notification sequence...');
  
  // Get user's FCM token
  const { data: subscription, error: subError } = await supabase
    .from('push_subscriptions')
    .select('fcm_token')
    .eq('user_id', userId)
    .maybeSingle();

  if (subError || !subscription?.fcm_token) {
    throw new Error('No valid FCM token found for user');
  }

  // Get Firebase project configuration
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
  if (!projectId) {
    throw new Error('Firebase project ID not configured');
  }
  
  // Send the notification using FCM REST API
  const accessToken = await getFcmAccessToken();
  const response = await fetch(
    `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          token: subscription.fcm_token,
          notification: {
            title: 'Test Notification',
            body: message || 'This is a test notification'
          },
          webpush: {
            headers: {
              Urgency: 'high'
            },
            notification: {
              icon: '/icon-192.png',
              badge: '/icon-192.png',
              requireInteraction: true,
              actions: [
                {
                  action: 'view',
                  title: 'View'
                }
              ]
            },
            fcm_options: {
              link: '/reminders'
            }
          }
        }
      })
    }
  );

  const data = await response.json();
  if (!response.ok) {
    throw new Error(`FCM API error: ${data.error?.message || 'Unknown error'}`);
  }

  console.log('Test notification sent successfully. If you do not see the notification, check:');
  console.log('1. Browser notification permissions');
  console.log('2. Service worker logs in DevTools > Application > Service Workers');
  console.log('3. Network tab for the FCM response');
}