import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'
import { encode as base64url } from "https://deno.land/std@0.168.0/encoding/base64url.ts";
import { decode as base64Decode } from "https://deno.land/std@0.168.0/encoding/base64.ts";
import { createResponse, handleOptions } from '../_shared/headers.ts';

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

// Function to handle product ID transformation
function getBaseProductId(productId: string): string {
  console.log('Transforming product ID:', productId);
  // Handle both monthly and annual product IDs
  if (productId === 'touchbase.pro.premium.monthly') {
    console.log('Found transformed monthly product ID, using base product ID: touchbase_premium');
    return 'touchbase_premium';
  } else if (productId === 'touchbase.pro.premium.annual') {
    console.log('Found transformed annual product ID, using base product ID: touchbase_premium_annual');
    return 'touchbase_premium_annual';
  }
  // Otherwise return the original ID
  console.log('Using original product ID:', productId);
  return productId;
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

// Acknowledges a subscription purchase with Google Play
async function acknowledgeSubscription(
  packageName: string,
  productId: string,
  purchaseToken: string,
  accessToken: string
): Promise<void> {
  console.log('Acknowledging subscription purchase:', { productId, tokenLength: purchaseToken.length });
  
  const response = await fetch(
    `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/purchases/subscriptions/${productId}/tokens/${purchaseToken}:acknowledge`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    console.error('Failed to acknowledge subscription:', {
      status: response.status,
      error,
      productId,
      tokenLength: purchaseToken.length
    });
    
    // If already acknowledged, that's fine
    if (response.status === 400 && error.includes('already acknowledged')) {
      console.log('Purchase was already acknowledged');
      return;
    }
    
    throw new Error(`Failed to acknowledge subscription: ${error}`);
  }

  console.log('Successfully acknowledged subscription purchase');
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
    return handleOptions();
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

      // Transform product ID if needed
      const baseProductId = getBaseProductId(productId);

      // Verify purchase with Google Play API
      const packageName = Deno.env.get('ANDROID_PACKAGE_NAME')
      console.log('Package name from env:', packageName);
      const apiUrl = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/purchases/subscriptions/${baseProductId}/tokens/${purchaseToken}`;
      console.log('Calling Google Play API:', apiUrl);
      console.log('Authorization header:', `Bearer ${accessToken.substring(0, 10)}...`);
      
      const response = await fetch(apiUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
        },
      })

      const responseText = await response.text();
      console.log('Play API response status:', response.status);
      console.log('Play API response headers:', JSON.stringify(Object.fromEntries(response.headers.entries())));
      console.log('Play API response body:', responseText);

      if (!response.ok) {
        throw new Error(`Failed to verify purchase with Google Play: ${response.status} ${response.statusText}\nDetails: ${responseText}`);
      }

      let purchaseData: GooglePlayPurchase;
      try {
        purchaseData = JSON.parse(responseText);
      } catch (e) {
        console.error('Failed to parse purchase data:', e);
        throw new Error('Invalid purchase data format received from Google Play');
      }
      validatePurchaseData(purchaseData);

      // Acknowledge the subscription purchase with Google Play
      console.log('Acknowledging purchase with Google Play');
      await acknowledgeSubscription(
        packageName,
        baseProductId,
        purchaseToken,
        accessToken
      );

      // Update subscription in database
      console.log('Updating subscription in database');
      const { error: updateError } = await supabaseClient
        .from('subscriptions')
        .upsert({
          user_id: user.id,
          subscription_plan_id: baseProductId === 'touchbase_premium_annual' ? 'premium-annual' : 'premium',
          status: 'active',
          google_play_token: purchaseToken,
          valid_until: new Date(parseInt(purchaseData.expiryTimeMillis)).toISOString(),
        }, {
          onConflict: 'user_id',
          ignoreDuplicates: false
        })

      if (updateError) {
        logError('database update', updateError);
        throw updateError;
      }

      console.log('Purchase verification completed successfully');
      return createResponse({ 
        success: true,
        expiryDate: new Date(parseInt(purchaseData.expiryTimeMillis)).toISOString(),
      });
    } catch (googleError) {
      logError('google authentication', googleError);
      throw googleError;
    }
  } catch (error) {
    return createResponse(
      { 
        error: error.message,
        errorType: error.name,
      },
      { status: 400 }
    );
  }
});