import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'
import { encode as base64url } from "https://deno.land/std@0.168.0/encoding/base64url.ts";
import { decode as base64Decode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

// Google Play RTDN notification types
enum NotificationType {
  SUBSCRIPTION_RECOVERED = 1,
  SUBSCRIPTION_RENEWED = 2,
  SUBSCRIPTION_CANCELED = 3,
  SUBSCRIPTION_PURCHASED = 4,
  SUBSCRIPTION_ON_HOLD = 5,
  SUBSCRIPTION_IN_GRACE_PERIOD = 6,
  SUBSCRIPTION_RESTARTED = 7,
  SUBSCRIPTION_PRICE_CHANGE_CONFIRMED = 8,
  SUBSCRIPTION_DEFERRED = 9,
  SUBSCRIPTION_PAUSED = 10,
  SUBSCRIPTION_PAUSE_SCHEDULE_CHANGED = 11,
  SUBSCRIPTION_REVOKED = 12,
  SUBSCRIPTION_EXPIRED = 13,
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

interface PubSubMessage {
  message: {
    data: string;
    messageId: string;
    publishTime: string;
    attributes?: Record<string, string>;
  };
  subscription: string;
}

interface JWTHeader {
  kid: string;
  alg: string;
}

// Cache for Google's public keys
let publicKeysCache: {
  keys: Record<string, CryptoKey>;
  expiresAt: number;
} | null = null;

async function fetchGooglePublicKeys(): Promise<Record<string, CryptoKey>> {
  if (publicKeysCache && Date.now() < publicKeysCache.expiresAt) {
    return publicKeysCache.keys;
  }

  const response = await fetch('https://www.googleapis.com/oauth2/v3/certs');
  if (!response.ok) {
    throw new Error('Failed to fetch Google public keys');
  }

  const cacheControl = response.headers.get('cache-control');
  let maxAge = 3600; // Default to 1 hour
  if (cacheControl) {
    const match = cacheControl.match(/max-age=(\d+)/);
    if (match) {
      maxAge = parseInt(match[1], 10);
    }
  }

  const keys = await response.json();
  const publicKeys: Record<string, CryptoKey> = {};

  // Convert JWK to CryptoKey
  for (const key of keys.keys) {
    const publicKey = await crypto.subtle.importKey(
      'jwk',
      key,
      {
        name: 'RSASSA-PKCS1-v1_5',
        hash: 'SHA-256',
      },
      true,
      ['verify']
    );
    publicKeys[key.kid] = publicKey;
  }

  publicKeysCache = {
    keys: publicKeys,
    expiresAt: Date.now() + (maxAge * 1000),
  };

  return publicKeys;
}

async function verifyPubSubJWT(authHeader: string | null): Promise<void> {
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Missing or invalid Authorization header');
  }

  const token = authHeader.substring(7);
  const [headerB64, payloadB64, signatureB64] = token.split('.');

  if (!headerB64 || !payloadB64 || !signatureB64) {
    throw new Error('Invalid JWT format');
  }

  // Decode the header to get the key ID
  const header = JSON.parse(atob(headerB64)) as JWTHeader;
  const publicKeys = await fetchGooglePublicKeys();
  const publicKey = publicKeys[header.kid];

  if (!publicKey) {
    throw new Error('No matching public key found');
  }

  // Verify the signature
  const signatureInput = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  const signature = base64Decode(signatureB64.replace(/-/g, '+').replace(/_/g, '/'));

  const isValid = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    publicKey,
    signature,
    signatureInput
  );

  if (!isValid) {
    throw new Error('Invalid JWT signature');
  }

  // Verify claims
  const payload = JSON.parse(atob(payloadB64));
  const now = Math.floor(Date.now() / 1000);

  if (payload.exp && now >= payload.exp) {
    throw new Error('JWT has expired');
  }

  if (payload.iat && now < payload.iat) {
    throw new Error('JWT issued in the future');
  }

  // Verify audience is our Cloud Function URL
  const expectedAudience = `${Deno.env.get('SUPABASE_URL')}/functions/v1/google-play-webhooks`;
  if (payload.aud !== expectedAudience) {
    throw new Error('Invalid JWT audience');
  }

  // Verify issuer is Google Cloud Pub/Sub
  const expectedIssuer = 'https://accounts.google.com';
  if (payload.iss !== expectedIssuer) {
    throw new Error('Invalid JWT issuer');
  }
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
    // Verify request method
    if (req.method === 'OPTIONS') {
      return new Response('ok', {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST',
          'Access-Control-Allow-Headers': 'authorization, content-type',
        }
      });
    }
    
    if (req.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    // Verify the Pub/Sub JWT token
    try {
      await verifyPubSubJWT(req.headers.get('Authorization'));
    } catch (error) {
      console.error('JWT verification failed:', error);
      return new Response(`Unauthorized: ${error.message}`, { status: 401 });
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase credentials');
    }
    const supabase = createClient(supabaseUrl, supabaseKey);

   // Get the raw body and parse the Pub/Sub message
   const rawBody = await req.text();
   console.log('[Google Play Webhook] Received request:', {
     timestamp: new Date().toISOString(),
     bodyLength: rawBody.length,
     headers: Object.fromEntries(req.headers.entries())
   });

   let notification: GooglePlayNotification;
   try {
     // Parse the Pub/Sub message wrapper
     const pubSubMessage = JSON.parse(rawBody) as PubSubMessage;
     console.log('[Google Play Webhook] Parsed Pub/Sub message:', {
       messageId: pubSubMessage.message.messageId,
       publishTime: pubSubMessage.message.publishTime,
       subscription: pubSubMessage.subscription
     });

     if (!pubSubMessage.message?.data) {
       throw new Error('Invalid Pub/Sub message format');
     }

     // Decode the base64-encoded data
     const decodedData = atob(pubSubMessage.message.data);
     
     // Parse the actual notification
     notification = JSON.parse(decodedData);
     console.log('[Google Play Webhook] Parsed notification:', {
       version: notification.version,
       packageName: notification.packageName,
       eventTime: new Date(parseInt(notification.eventTimeMillis)).toISOString(),
       notificationType: notification.subscriptionNotification?.notificationType,
       subscriptionId: notification.subscriptionNotification?.subscriptionId
     });
   } catch (error) {
     console.error('[Google Play Webhook] Error parsing message:', {
       error: error.message,
       stack: error.stack,
       timestamp: new Date().toISOString()
     });
     return new Response('Invalid message format', { status: 400 });
   }

   if (!notification.subscriptionNotification) {
     console.log('[Google Play Webhook] Ignoring non-subscription notification:', {
       version: notification.version,
       packageName: notification.packageName,
       eventTime: new Date(parseInt(notification.eventTimeMillis)).toISOString()
     });
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
    let shouldNullifyToken = false;

    console.log('[Google Play Webhook] Processing subscription status change:', {
      notificationType: notification.subscriptionNotification.notificationType,
      purchaseToken: notification.subscriptionNotification.purchaseToken,
      subscriptionId: notification.subscriptionNotification.subscriptionId,
      currentStatus: subscription.status
    });

    switch (notification.subscriptionNotification.notificationType) {
      case NotificationType.SUBSCRIPTION_CANCELED:
      case NotificationType.SUBSCRIPTION_REVOKED:
        status = 'canceled';
        shouldNullifyToken = true;
        console.log('[Google Play Webhook] Subscription canceled/revoked:', {
          id: subscription.id,
          userId: subscription.user_id,
          notificationType: notification.subscriptionNotification.notificationType
        });
        break;
      case NotificationType.SUBSCRIPTION_EXPIRED:
        status = 'expired';
        shouldNullifyToken = true;
        console.log('[Google Play Webhook] Subscription expired:', {
          id: subscription.id,
          userId: subscription.user_id,
          notificationType: notification.subscriptionNotification.notificationType
        });
        break;
      case NotificationType.SUBSCRIPTION_PURCHASED:
      case NotificationType.SUBSCRIPTION_RENEWED:
      case NotificationType.SUBSCRIPTION_RECOVERED:
      case NotificationType.SUBSCRIPTION_RESTARTED:
        status = 'active';
        console.log('[Google Play Webhook] Subscription activated/renewed:', {
          id: subscription.id,
          userId: subscription.user_id,
          notificationType: notification.subscriptionNotification.notificationType
        });
        break;
      default:
        console.log('[Google Play Webhook] Unhandled notification type:', {
          notificationType: notification.subscriptionNotification.notificationType,
          subscriptionId: subscription.id,
          userId: subscription.user_id
        });
    }

    // Prepare update data
    const updateData: any = {
      status,
      valid_until: subscriptionDetails.expiryTimeMillis
        ? new Date(parseInt(subscriptionDetails.expiryTimeMillis)).toISOString()
        : undefined,
    };

    // Nullify token if subscription is canceled/expired
    if (shouldNullifyToken) {
      updateData.google_play_token = null;
    }

    console.log('[Google Play Webhook] Updating subscription:', {
      id: subscription.id,
      oldStatus: subscription.status,
      newStatus: status,
      willNullifyToken: shouldNullifyToken,
      newValidUntil: updateData.valid_until
    });

    // Update the subscription in our database
    const { error: updateError } = await supabase
      .from('subscriptions')
      .update(updateData)
      .eq('id', subscription.id);

    if (updateError) {
      console.error('[Google Play Webhook] Failed to update subscription:', {
        error: updateError,
        subscriptionId: subscription.id,
        userId: subscription.user_id,
        notificationType: notification.subscriptionNotification.notificationType
      });
      throw updateError;
    }

    console.log('[Google Play Webhook] Successfully updated subscription:', {
      id: subscription.id,
      oldStatus: subscription.status,
      newStatus: status,
      tokenNullified: shouldNullifyToken,
      notificationType: notification.subscriptionNotification.notificationType
    });

    // Log successful completion
    console.log('[Google Play Webhook] Successfully processed event:', {
      eventType: notification.subscriptionNotification.notificationType,
      subscriptionId: subscription.id,
      timestamp: new Date().toISOString()
    });

    // Acknowledge the message by returning a success response
    return new Response('OK', { status: 200 });
  } catch (error) {
    // Get detailed error information
    const errorDetails = {
      message: error.message,
      stack: error.stack,
      name: error.name,
      cause: error.cause
    };

    // Determine appropriate status code
    let status = 400;
    if (error.message.includes('Missing Supabase credentials') ||
        error.message.includes('Failed to get access token')) {
      status = 500;
    } else if (error.message.includes('Invalid JWT') ||
               error.message.includes('Unauthorized')) {
      status = 401;
    } else if (error.message.includes('Subscription not found')) {
      status = 404;
    }

    // Log the full error details
    console.error('[Google Play Webhook] Error processing webhook:', {
      ...errorDetails,
      timestamp: new Date().toISOString(),
      status,
      endpoint: req.url,
      method: req.method,
      headers: Object.fromEntries(req.headers.entries())
    });
    
    return new Response(
      JSON.stringify({
        error: error.message,
        timestamp: new Date().toISOString(),
        status
      }),
      {
        status,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
  }
});