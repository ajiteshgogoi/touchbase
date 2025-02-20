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

interface VerifyRequest {
  purchaseToken: string;
  productId: string;
}

interface GooglePlayPurchase {
  expiryTimeMillis: string;
  orderId?: string;
  paymentState?: number;
  [key: string]: any;
}

function logError(stage: string, error: any) {
  console.error(`Error at ${stage}:`, {
    message: error.message,
    name: error.name,
    stack: error.stack,
  });
}

function validateEnvironmentVars() {
  const requiredVars = [
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'GOOGLE_SERVICE_ACCOUNT_EMAIL',
    'GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY',
    'ANDROID_PACKAGE_NAME'
  ];

  const missing = requiredVars.filter(varName => !Deno.env.get(varName));
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  console.log('Environment validation:', {
    hasSupabaseUrl: !!Deno.env.get('SUPABASE_URL'),
    hasServiceAccountEmail: !!Deno.env.get('GOOGLE_SERVICE_ACCOUNT_EMAIL'),
    hasPrivateKey: !!Deno.env.get('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY'),
    packageName: Deno.env.get('ANDROID_PACKAGE_NAME'),
  });
}

function validatePurchaseData(data: GooglePlayPurchase) {
  if (!data.expiryTimeMillis) {
    throw new Error('Invalid purchase data: missing expiryTimeMillis');
  }

  console.log('Purchase data validation:', {
    hasExpiryTime: !!data.expiryTimeMillis,
    paymentState: data.paymentState,
    orderId: data.orderId ? '[PRESENT]' : '[MISSING]',
    expiryDate: new Date(parseInt(data.expiryTimeMillis)).toISOString(),
  });
}

async function createGoogleJWT(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const privateKey = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY')?.replace(/\\n/g, '\n') ?? '';
  const email = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_EMAIL') ?? '';

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
  const jwt = await createGoogleJWT();
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

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get access token: ${error}`);
  }

  const data = await response.json();
  return data.access_token;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: addCorsHeaders() })
  }

  try {
    console.log('Starting purchase verification');
    validateEnvironmentVars();

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get the authorization header from the request
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('No authorization header')
    }

    // Get the JWT token from the authorization header
    const token = authHeader.replace('Bearer ', '')
    console.log('Authenticating user');

    // Get the user from the JWT token
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser(token)
    if (userError || !user) {
      logError('user authentication', userError || new Error('Invalid user token'));
      throw new Error('Invalid user token');
    }
    console.log('User authenticated:', { userId: user.id });

    // Get request body
    const { purchaseToken, productId } = await req.json() as VerifyRequest
    if (!purchaseToken || !productId) {
      throw new Error('Missing required fields: purchaseToken or productId');
    }
    console.log('Verifying purchase:', { productId, tokenLength: purchaseToken.length });

    try {
      // Get access token
      console.log('Getting Google access token');
      const accessToken = await getGoogleAccessToken();
      console.log('Got access token');

      // Verify purchase with Google Play API
      const packageName = Deno.env.get('ANDROID_PACKAGE_NAME')
      console.log('Calling Google Play API');
      const response = await fetch(
        `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/purchases/subscriptions/${productId}/tokens/${purchaseToken}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      )

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Google Play API error:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText,
        });
        throw new Error(`Failed to verify purchase with Google Play: ${response.status} ${response.statusText}`);
      }

      const purchaseData: GooglePlayPurchase = await response.json()
      validatePurchaseData(purchaseData);

      // Update subscription in database
      console.log('Updating subscription in database');
      const { error: updateError } = await supabaseClient
        .from('subscriptions')
        .upsert({
          user_id: user.id,
          plan_id: 'premium',
          status: 'active',
          google_play_token: purchaseToken,
          valid_until: new Date(parseInt(purchaseData.expiryTimeMillis)).toISOString(),
        })

      if (updateError) {
        logError('database update', updateError);
        throw updateError;
      }

      console.log('Purchase verification completed successfully');
      return new Response(JSON.stringify({ 
        success: true,
        expiryDate: new Date(parseInt(purchaseData.expiryTimeMillis)).toISOString(),
      }), {
        headers: addCorsHeaders(new Headers({ 'Content-Type': 'application/json' })),
        status: 200,
      })
    } catch (googleError) {
      logError('google authentication', googleError);
      throw googleError;
    }
  } catch (error) {
    return new Response(
      JSON.stringify({ 
        error: error.message,
        errorType: error.name,
      }),
      {
        headers: addCorsHeaders(new Headers({ 'Content-Type': 'application/json' })),
        status: 400,
      }
    )
  }
})