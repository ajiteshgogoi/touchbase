import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { createResponse, handleOptions } from '../_shared/headers.ts';

serve(async (req) => {
  console.log('Received request:', {
    method: req.method,
    url: req.url
  });

  if (req.method === 'OPTIONS') {
    return handleOptions();
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
    const authResponse = await fetch('https://api-m.paypal.com/v1/oauth2/token', {
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

    // The baToken is actually the subscription ID from the create-subscription response
    const subscriptionId = baToken;

    // Get subscription details from PayPal
    console.log('Fetching subscription details...');
    const subscriptionResponse = await fetch(
      `https://api-m.paypal.com/v1/billing/subscriptions/${subscriptionId}`,
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
        id: subscriptionDetails.id,
        status: subscriptionDetails.status || 'missing',
        plan_id: subscriptionDetails.plan_id,
        start_time: subscriptionDetails.start_time,
        create_time: subscriptionDetails.create_time
      });
    } catch (e) {
      console.error('Failed to parse subscription response:', subscriptionResponseText);
      throw new Error('Invalid JSON in subscription response');
    }

    // Verify subscription is active in PayPal
    if (subscriptionDetails.status !== 'ACTIVE') {
      throw new Error(`Invalid subscription status: ${subscriptionDetails.status}`);
    }

    // Calculate valid_until date based on the plan
    const validUntil = new Date();
    const isAnnual = subscriptionDetails.plan_id === Deno.env.get('PREMIUM_ANNUAL_PLAN_ID');
    if (isAnnual) {
      validUntil.setFullYear(validUntil.getFullYear() + 1); // Add 1 year for annual
    } else {
      validUntil.setMonth(validUntil.getMonth() + 1); // Add 1 month for monthly
    }
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
      subscription_plan_id: subscriptionDetails.plan_id === Deno.env.get('PREMIUM_ANNUAL_PLAN_ID') ? 'premium-annual' : 'premium',
      status: 'active',
      paypal_subscription_id: subscriptionDetails.id.trim(),
      valid_until: validUntil.toISOString()
    }

    console.log('Upserting subscription:', {
      operation: existingSubscription ? 'update' : 'insert',
      data: {
        ...subscriptionData,
        user_id: '[REDACTED]'
      }
    });
    const { error: upsertError, data: upsertedData } = existingSubscription
      ? await supabaseClient
          .from('subscriptions')
          .update(subscriptionData)
          .eq('user_id', user.id)
          .select()
      : await supabaseClient
          .from('subscriptions')
          .insert(subscriptionData)
          .select()

    if (upsertError) {
      console.error('Error upserting subscription:', upsertError);
      throw upsertError;
    }

    if (!upsertedData?.[0]) {
      console.error('Failed to get upserted subscription data');
      throw new Error('Failed to get upserted subscription data');
    }

    console.log('Subscription activated successfully:', {
      id: upsertedData[0].id,
      status: upsertedData[0].status,
      paypal_subscription_id: upsertedData[0].paypal_subscription_id,
      valid_until: upsertedData[0].valid_until
    });

    // Verify the subscription was stored correctly
    const { data: verifyData, error: verifyError } = await supabaseClient
      .from('subscriptions')
      .select('*')
      .eq('paypal_subscription_id', subscriptionDetails.id.trim())
      .single();

    console.log('Verification check:', {
      found: !!verifyData,
      error: verifyError,
      subscription: verifyData ? {
        id: verifyData.id,
        paypal_subscription_id: verifyData.paypal_subscription_id,
        status: verifyData.status
      } : null
    });

    if (!verifyData) {
      console.error('Failed to verify subscription storage');
      throw new Error('Failed to verify subscription storage');
    }
    
    return createResponse({ success: true });
  } catch (error) {
    return createResponse(
      { error: error.message },
      { status: 400 }
    );
  }
});