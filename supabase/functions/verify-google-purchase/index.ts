import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'
import { GoogleAuth } from 'https://cdn.skypack.dev/google-auth-library@6.1.3'

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

  // Log non-sensitive environment variable presence
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
      // Initialize Google Auth
      const auth = new GoogleAuth({
        credentials: {
          client_email: Deno.env.get('GOOGLE_SERVICE_ACCOUNT_EMAIL'),
          private_key: Deno.env.get('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY')?.replace(/\\n/g, '\n'),
        },
        scopes: ['https://www.googleapis.com/auth/androidpublisher'],
      })

      // Get access token
      console.log('Getting Google access token');
      const client = await auth.getClient()
      const accessToken = await client.getAccessToken()
      console.log('Got access token:', { type: accessToken.type });

      // Verify purchase with Google Play API
      const packageName = Deno.env.get('ANDROID_PACKAGE_NAME')
      console.log('Calling Google Play API');
      const response = await fetch(
        `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/purchases/subscriptions/${productId}/tokens/${purchaseToken}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken.token}`,
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