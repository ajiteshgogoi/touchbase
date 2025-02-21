import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'
import { encode as base64url } from "https://deno.land/std@0.168.0/encoding/base64url.ts";
import { decode as base64Decode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

function addCorsHeaders(headers: Headers = new Headers()) {
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'authorization, x-client-info, apikey, content-type');
  headers.set('Access-Control-Max-Age', '86400');
  headers.set('Access-Control-Allow-Credentials', 'true');
  return headers;
}

async function createGoogleJWT(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const privateKey = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY')?.replace(/\\n/g, '\n') ?? '';
  const email = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_EMAIL') ?? '';

  console.log('Creating JWT with email:', email);
  console.log('Private key starts with:', privateKey.substring(0, 50) + '...');

  const header = {
    alg: 'RS256',
    typ: 'JWT',
  };

  const claim = {
    iss: email,
    scope: 'https://www.googleapis.com/auth/androidpublisher',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  console.log('JWT claims:', JSON.stringify(claim));
  const encodedHeader = base64url(new TextEncoder().encode(JSON.stringify(header)));
  const encodedClaim = base64url(new TextEncoder().encode(JSON.stringify(claim)));
  const signatureInput = `${encodedHeader}.${encodedClaim}`;

  // Convert PEM to raw private key
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
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256',
    },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    { name: 'RSASSA-PKCS1-v1_5' },
    key,
    new TextEncoder().encode(signatureInput)
  );

  const encodedSignature = base64url(new Uint8Array(signature));
  return `${signatureInput}.${encodedSignature}`;
}

async function getGoogleAccessToken(): Promise<string> {
  console.log('Creating JWT with claims...');
  const jwt = await createGoogleJWT();
  console.log('JWT created successfully');

  console.log('Requesting access token from Google OAuth...');
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  const responseText = await response.text();
  console.log('OAuth response status:', response.status);
  console.log('OAuth response headers:', JSON.stringify(Object.fromEntries(response.headers.entries())));
  console.log('OAuth response body:', responseText);

  if (!response.ok) {
    throw new Error(`Failed to get access token: ${responseText}`);
  }

  const data = JSON.parse(responseText);
  console.log('Access token obtained, token type:', data.token_type);
  return data.access_token;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: addCorsHeaders() })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get request body
    const { token } = await req.json()

    // Get subscription details
    console.log('Fetching subscription details for token:', token);
    const { data: subscription, error: fetchError } = await supabaseClient
      .from('subscriptions')
      .select('*')
      .eq('google_play_token', token)
      .single()

    console.log('Subscription fetch result:', {
      hasData: Boolean(subscription),
      error: fetchError,
      subscriptionStatus: subscription?.status,
      token: token
    });

    if (fetchError || !subscription) {
      console.error('Subscription not found:', {
        error: fetchError,
        token: token
      });
      throw new Error('Subscription not found');
    }

    // Only proceed if subscription is active
    if (subscription.status !== 'active') {
      console.error('Invalid subscription status:', {
        currentStatus: subscription.status,
        token: token,
        validUntil: subscription.valid_until
      });
      throw new Error('Subscription is not active');
    }

    console.log('Verified active subscription:', {
      status: subscription.status,
      token: token,
      validUntil: subscription.valid_until
    });

    // Get access token
    console.log('Getting Google access token');
    const accessToken = await getGoogleAccessToken();
    console.log('Got access token');

    // Get the product ID from the premium plan
    const premiumPlan = {
      googlePlayProductId: 'touchbase_premium'
    };

    // Cancel subscription with Google Play API
    const packageName = Deno.env.get('ANDROID_PACKAGE_NAME')
    console.log('Initiating Google Play subscription cancellation...', {
      packageName,
      productId: premiumPlan.googlePlayProductId,
      token: token
    });

    const response = await fetch(
      `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/purchases/subscriptions/${premiumPlan.googlePlayProductId}/tokens/${token}:cancel`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    )

    const responseText = await response.text();
    console.log('Play API response status:', response.status);
    console.log('Play API response headers:', JSON.stringify(Object.fromEntries(response.headers.entries())));
    console.log('Play API response body:', responseText);

    if (!response.ok) {
      const errorData = JSON.parse(responseText);
      console.error('Google Play API error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorData,
        token: token
      });
      throw new Error(`Failed to cancel subscription with Google Play: ${errorData.error?.message || 'Unknown error'}`);
    }

    console.log('Google Play cancellation successful', {
      status: response.status,
      token: token
    });

    // Update subscription status in database
    const { error: updateError } = await supabaseClient
      .from('subscriptions')
      .update({
        status: 'canceled', // Using the correct status from schema
        // Keep google_play_token for potential UI needs
      })
      .eq('google_play_token', token)

    if (updateError) {
      console.error('Database update error:', updateError);
      throw updateError;
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: addCorsHeaders(new Headers({ 'Content-Type': 'application/json' })),
      status: 200,
    })
  } catch (error) {
    console.error('Cancellation error:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });

    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: error.stack || 'No stack trace available'
      }),
      {
        headers: addCorsHeaders(new Headers({ 'Content-Type': 'application/json' })),
        status: 400,
      }
    )
  }
})