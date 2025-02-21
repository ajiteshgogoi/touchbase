import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'
import { encode as base64url } from "https://deno.land/std@0.168.0/encoding/base64url.ts";
import { decode as base64Decode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

// Google Play RTDN notification types
enum NotificationType {
  SUBSCRIPTION_RECOVERED = 1, // Subscription was recovered from account hold
  SUBSCRIPTION_RENEWED = 2, // Subscription was renewed
  SUBSCRIPTION_CANCELED = 3, // Subscription was voluntarily or involuntarily canceled
  SUBSCRIPTION_PURCHASED = 4, // Subscription was purchased
  SUBSCRIPTION_ON_HOLD = 5, // Subscription entered account hold
  SUBSCRIPTION_IN_GRACE_PERIOD = 6, // Subscription entered grace period
  SUBSCRIPTION_RESTARTED = 7, // User has reactivated their subscription
  SUBSCRIPTION_PRICE_CHANGE_CONFIRMED = 8,
  SUBSCRIPTION_DEFERRED = 9, // Subscription was deferred
  SUBSCRIPTION_PAUSED = 10, // Subscription was paused
  SUBSCRIPTION_PAUSE_SCHEDULE_CHANGED = 11,
  SUBSCRIPTION_REVOKED = 12, // Subscription was revoked
  SUBSCRIPTION_EXPIRED = 13, // Subscription has expired
}

interface GooglePlayNotification {
  version: string;
  packageName: string;
  eventTimeMillis: string;
  subscriptionNotification?: {
    version: string;
    notificationType: NotificationType;
    purchaseToken: string;
    subscriptionId: string;
  };
}

async function getGoogleAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const privateKey = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY')?.replace(/\\n/g, '\n') ?? '';
  const email = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_EMAIL') ?? '';

  const header = { alg: 'RS256', typ: 'JWT' };
  const claim = {
    iss: email,
    scope: 'https://www.googleapis.com/auth/androidpublisher',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  const encodedHeader = base64url(new TextEncoder().encode(JSON.stringify(header)));
  const encodedClaim = base64url(new TextEncoder().encode(JSON.stringify(claim)));
  const signatureInput = `${encodedHeader}.${encodedClaim}`;

  const pemHeader = '-----BEGIN PRIVATE KEY-----';
  const pemFooter = '-----END PRIVATE KEY-----';
  const pemContents = privateKey.substring(
    privateKey.indexOf(pemHeader) + pemHeader.length,
    privateKey.indexOf(pemFooter),
  ).replace(/\s/g, '');
  
  const binaryKey = base64Decode(pemContents);
  const key = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    { name: 'RSASSA-PKCS1-v1_5' },
    key,
    new TextEncoder().encode(signatureInput)
  );

  const encodedSignature = base64url(new Uint8Array(signature));
  const jwt = `${signatureInput}.${encodedSignature}`;

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to get access token: ${await response.text()}`);
  }

  const data = await response.json();
  return data.access_token;
}

async function getSubscriptionDetails(
  packageName: string,
  subscriptionId: string,
  purchaseToken: string,
  accessToken: string
): Promise<{ expiryTimeMillis?: string }> {
  const response = await fetch(
    `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/purchases/subscriptions/${subscriptionId}/tokens/${purchaseToken}`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to get subscription details: ${await response.text()}`);
  }

  return response.json();
}

serve(async (req) => {
  try {
    // Verify the request
    if (req.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase credentials');
    }
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse the notification
    const notification = await req.json() as GooglePlayNotification;
    console.log('Received notification:', JSON.stringify(notification));

    if (!notification.subscriptionNotification) {
      return new Response('Not a subscription notification', { status: 400 });
    }

    // Get subscription details from Google Play
    const accessToken = await getGoogleAccessToken();
    const subscriptionDetails = await getSubscriptionDetails(
      notification.packageName,
      notification.subscriptionNotification.subscriptionId,
      notification.subscriptionNotification.purchaseToken,
      accessToken
    );

    // Find the subscription in our database
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('id, user_id, status')
      .eq('google_play_token', notification.subscriptionNotification.purchaseToken)
      .single();

    if (!subscription) {
      console.error('No subscription found for purchase token:', notification.subscriptionNotification.purchaseToken);
      return new Response('Subscription not found', { status: 404 });
    }

    // Update subscription status based on notification type
    let status: 'active' | 'canceled' | 'expired' = 'active';
    switch (notification.subscriptionNotification.notificationType) {
      case NotificationType.SUBSCRIPTION_CANCELED:
      case NotificationType.SUBSCRIPTION_REVOKED:
        status = 'canceled';
        break;
      case NotificationType.SUBSCRIPTION_EXPIRED:
        status = 'expired';
        break;
      case NotificationType.SUBSCRIPTION_PURCHASED:
      case NotificationType.SUBSCRIPTION_RENEWED:
      case NotificationType.SUBSCRIPTION_RECOVERED:
      case NotificationType.SUBSCRIPTION_RESTARTED:
        status = 'active';
        break;
      // Handle other states as 'active' but log them
      default:
        console.log('Unhandled notification type:', notification.subscriptionNotification.notificationType);
    }

    // Update the subscription in our database
    const { error: updateError } = await supabase
      .from('subscriptions')
      .update({
        status,
        valid_until: subscriptionDetails.expiryTimeMillis 
          ? new Date(parseInt(subscriptionDetails.expiryTimeMillis)).toISOString()
          : undefined,
      })
      .eq('id', subscription.id);

    if (updateError) {
      console.error('Failed to update subscription:', updateError);
      throw updateError;
    }

    return new Response('OK', { status: 200 });
  } catch (error) {
    console.error('Error processing webhook:', error);
    return new Response(error.message, { status: 500 });
  }
});