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
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: addCorsHeaders() })
  }

  try {
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
    const { planId: requestedPlanId } = await req.json()
    if (requestedPlanId !== 'premium') throw new Error('Invalid plan ID')

    // Initialize PayPal client
    const clientId = Deno.env.get('PAYPAL_CLIENT_ID')
    const clientSecret = Deno.env.get('PAYPAL_CLIENT_SECRET')

    if (!clientId || !clientSecret) {
      throw new Error('PayPal credentials not configured')
    }

    // Log PayPal credentials status (safely)
    console.log('PayPal Credentials Status:', {
      hasClientId: !!clientId,
      hasClientSecret: !!clientSecret,
      clientIdLength: clientId?.length,
      clientSecretLength: clientSecret?.length
    });

    const paypalAuthHeaders = {
      'Accept': 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`
    };

    console.log('PayPal Auth Request:', {
      url: 'https://api-m.sandbox.paypal.com/v1/oauth2/token',
      method: 'POST',
      headers: {
        ...paypalAuthHeaders,
        'Authorization': 'Basic [REDACTED]'
      }
    });

    const paypalAuth = await fetch('https://api-m.sandbox.paypal.com/v1/oauth2/token', {
      method: 'POST',
      headers: paypalAuthHeaders,
      body: 'grant_type=client_credentials'
    });

    const authResponseText = await paypalAuth.text();
    let paypalAuthData;

    try {
      paypalAuthData = JSON.parse(authResponseText);
      console.log('PayPal Auth Response:', {
        status: paypalAuth.status,
        ok: paypalAuth.ok,
        responseData: {
          ...paypalAuthData,
          access_token: paypalAuthData.access_token ? '[REDACTED]' : undefined
        }
      });
    } catch (e) {
      console.error('Failed to parse PayPal auth response:', authResponseText);
      throw new Error('Invalid JSON in PayPal auth response');
    }

    if (!paypalAuth.ok) {
      throw new Error(`PayPal authentication failed: ${paypalAuthData.error_description || paypalAuthData.message || authResponseText}`);
    }

    if (!paypalAuthData.access_token) {
      console.error('PayPal auth response:', {...paypalAuthData, access_token: '[REDACTED]'});
      throw new Error('Invalid PayPal auth response - missing access token');
    }

    const paypalToken = paypalAuthData.access_token;

    // Create subscription with PayPal
    const paypalPlanId = Deno.env.get('PREMIUM_PLAN_ID')
    const appUrl = Deno.env.get('APP_URL')

    if (!paypalPlanId || !appUrl) {
      throw new Error('Missing required environment variables')
    }

    // Log environment variables
    console.log('Environment Variables:', {
      paypalPlanId,
      appUrl
    });

    const return_url = new URL('/settings?subscription=success', appUrl).toString();
    const cancel_url = new URL('/settings?subscription=cancelled', appUrl).toString();

    // Log constructed URLs
    console.log('Constructed URLs:', {
      return_url,
      cancel_url
    });

    const subscriptionPayload = {
      plan_id: paypalPlanId,
      application_context: {
        brand_name: 'TouchBase',
        return_url,
        cancel_url,
        user_action: 'SUBSCRIBE_NOW',
        shipping_preference: 'NO_SHIPPING'
      }
    }

    console.log('PayPal API Request:', {
      url: 'https://api-m.sandbox.paypal.com/v1/billing/subscriptions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${paypalToken}`,
        'PayPal-Request-Id': crypto.randomUUID(),
        'Prefer': 'return=representation'
      },
      payload: subscriptionPayload
    });

    const subscription = await fetch('https://api-m.sandbox.paypal.com/v1/billing/subscriptions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${paypalToken}`,
        'PayPal-Request-Id': crypto.randomUUID(),
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(subscriptionPayload)
    })

    let subscriptionData
    const responseText = await subscription.text()

    try {
      subscriptionData = JSON.parse(responseText)
    } catch (e) {
      console.error('Failed to parse PayPal response:', responseText)
      throw new Error('Invalid response from PayPal')
    }

    if (!subscription.ok) {
      const errorDetails = {
        status: subscription.status,
        statusText: subscription.statusText,
        response: subscriptionData,
        headers: Object.fromEntries(subscription.headers.entries()),
        request: {
          payload: subscriptionPayload,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer [REDACTED]',
            'PayPal-Request-Id': crypto.randomUUID(),
            'Prefer': 'return=representation'
          }
        }
      };
      console.error('PayPal API Error Details:', JSON.stringify(errorDetails, null, 2));
      throw new Error(`PayPal API Error: ${subscriptionData.message || subscriptionData.error_description || 'Unknown error'}. Details: ${JSON.stringify(subscriptionData.details || {})}`);
    }

    if (!subscriptionData.id || !subscriptionData.links) {
      console.error('Invalid subscription response:', JSON.stringify(subscriptionData, null, 2))
      throw new Error('Invalid subscription data received from PayPal')
    }

    // Update subscription in database
    const { error: updateError } = await supabaseClient
      .from('subscriptions')
      .upsert({
        user_id: user.id,
        plan_id: 'premium',
        status: 'pending',
        paypal_subscription_id: subscriptionData.id,
        valid_until: null // Will be updated when subscription is activated
      })

    if (updateError) throw updateError

    return new Response(
      JSON.stringify({
        subscriptionId: subscriptionData.id,
        approvalUrl: subscriptionData.links.find(
          (link: { rel: string }) => link.rel === 'approve'
        ).href
      }),
      {
        headers: addCorsHeaders(new Headers({ 'Content-Type': 'application/json' })),
        status: 200,
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: addCorsHeaders(new Headers({ 'Content-Type': 'application/json' })),
        status: 400,
      }
    )
  }
})