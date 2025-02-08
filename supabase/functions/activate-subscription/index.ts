import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

function addCorsHeaders(headers: Headers = new Headers()) {
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'authorization, x-client-info, apikey, content-type');
  headers.set('Access-Control-Max-Age', '86400');
  headers.set('Access-Control-Allow-Credentials', 'true');
  return headers;
}

serve(async (req) => {
  console.log('Received request:', {
    method: req.method,
    url: req.url
  });

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: addCorsHeaders() })
  }

  try {
    console.log('Initializing Supabase client...');
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

    // Get the user from the JWT token
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser(token)
    if (userError || !user) throw new Error('Invalid user token')

    // Get request body
    console.log('Parsing request body...');
    const reqBody = await req.json();
    console.log('Request body:', { baToken: reqBody?.baToken ? '[REDACTED]' : 'missing' });

    if (!reqBody?.baToken) {
      throw new Error('No billing agreement token provided');
    }
    const { baToken } = reqBody;

    // Get PayPal credentials
    console.log('Getting PayPal credentials...');
    const clientId = Deno.env.get('PAYPAL_CLIENT_ID')
    const clientSecret = Deno.env.get('PAYPAL_CLIENT_SECRET')
    
    console.log('PayPal credentials status:', {
      hasClientId: !!clientId,
      hasClientSecret: !!clientSecret
    });

    if (!clientId || !clientSecret) {
      throw new Error('PayPal credentials not configured')
    }

    // Get PayPal access token
    console.log('Requesting PayPal access token...');
    const authResponse = await fetch('https://api-m.sandbox.paypal.com/v1/oauth2/token', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`
      },
      body: 'grant_type=client_credentials'
    });

    const authResponseText = await authResponse.text();
    console.log('PayPal auth response:', {
      status: authResponse.status,
      ok: authResponse.ok,
      headers: Object.fromEntries(authResponse.headers.entries()),
      body: authResponseText
    });

    if (!authResponse.ok) {
      throw new Error(`Failed to get PayPal access token: ${authResponse.status} ${authResponseText}`)
    }

    let authData;
    try {
      authData = JSON.parse(authResponseText);
    } catch (e) {
      console.error('Failed to parse PayPal auth response:', authResponseText);
      throw new Error('Invalid JSON in PayPal auth response');
    }

    if (!authData.access_token) {
      console.error('PayPal auth response missing token:', authData);
      throw new Error('No access token in PayPal response');
    }

    const paypalToken = authData.access_token;
    console.log('Successfully obtained PayPal access token');

    // Get the subscription ID from billing agreement token
    console.log('Fetching billing agreement details...');
    const subscriptionIdResponse = await fetch(
      `https://api-m.sandbox.paypal.com/v1/billing/agreements/${baToken}`,
      {
        headers: {
          'Authorization': `Bearer ${paypalToken}`,
          'Content-Type': 'application/json'
        }
      }
    )

    const agreementResponseText = await subscriptionIdResponse.text();
    console.log('PayPal agreement response:', {
      status: subscriptionIdResponse.status,
      ok: subscriptionIdResponse.ok,
      headers: Object.fromEntries(subscriptionIdResponse.headers.entries()),
      body: agreementResponseText
    });

    if (!subscriptionIdResponse.ok) {
      throw new Error(`Failed to get subscription ID from billing agreement: ${subscriptionIdResponse.status} ${agreementResponseText}`)
    }

    let agreement;
    try {
      agreement = JSON.parse(agreementResponseText);
      console.log('Agreement details:', {
        ...agreement,
        subscription_id: agreement.subscription_id ? '[REDACTED]' : 'missing'
      });
    } catch (e) {
      console.error('Failed to parse agreement response:', agreementResponseText);
      throw new Error('Invalid JSON in agreement response');
    }

    const subscriptionId = agreement.subscription_id;
    if (!subscriptionId) {
      throw new Error('No subscription_id found in agreement response');
    }

    // Get subscription details from PayPal
    console.log('Fetching subscription details...');
    const subscriptionResponse = await fetch(
      `https://api-m.sandbox.paypal.com/v1/billing/subscriptions/${subscriptionId}`,
      {
        headers: {
          'Authorization': `Bearer ${paypalToken}`,
          'Content-Type': 'application/json'
        }
      }
    )

    const subscriptionResponseText = await subscriptionResponse.text();
    console.log('PayPal subscription response:', {
      status: subscriptionResponse.status,
      ok: subscriptionResponse.ok,
      headers: Object.fromEntries(subscriptionResponse.headers.entries()),
      body: subscriptionResponseText
    });

    if (!subscriptionResponse.ok) {
      throw new Error(`Failed to get subscription details: ${subscriptionResponse.status} ${subscriptionResponseText}`)
    }

    let subscriptionDetails;
    try {
      subscriptionDetails = JSON.parse(subscriptionResponseText);
      console.log('Subscription details:', {
        ...subscriptionDetails,
        id: '[REDACTED]',
        status: subscriptionDetails.status || 'missing'
      });
    } catch (e) {
      console.error('Failed to parse subscription response:', subscriptionResponseText);
      throw new Error('Invalid JSON in subscription response');
    }

    // Verify subscription is active in PayPal
    if (subscriptionDetails.status !== 'ACTIVE') {
      throw new Error(`Invalid subscription status: ${subscriptionDetails.status}`);
    }

    // Calculate valid_until date (1 month from now for monthly subscription)
    const validUntil = new Date()
    validUntil.setMonth(validUntil.getMonth() + 1)
    console.log('Calculated valid_until:', validUntil.toISOString());

    // Check if subscription exists
    console.log('Checking for existing subscription...');
    const { data: existingSubscription, error: fetchError } = await supabaseClient
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    // Create or update subscription
    const subscriptionData = {
      user_id: user.id,
      plan_id: 'premium',
      status: 'active',
      paypal_subscription_id: subscriptionDetails.id,
      valid_until: validUntil.toISOString()
    }

    const { error: upsertError } = existingSubscription
      ? await supabaseClient
          .from('subscriptions')
          .update(subscriptionData)
          .eq('user_id', user.id)
      : await supabaseClient
          .from('subscriptions')
          .insert(subscriptionData)

    if (upsertError) throw upsertError

    return new Response(
      JSON.stringify({ success: true }),
      {
        headers: addCorsHeaders(new Headers({ 'Content-Type': 'application/json' })),
        status: 200
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: addCorsHeaders(new Headers({ 'Content-Type': 'application/json' })),
        status: 400
      }
    )
  }
})