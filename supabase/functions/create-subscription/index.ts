import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { createResponse, handleOptions } from '../_shared/headers.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return handleOptions();
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
    if (requestedPlanId !== 'premium' && requestedPlanId !== 'premium-annual') throw new Error('Invalid plan ID')

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
      url: 'https://api-m.paypal.com/v1/oauth2/token',
      method: 'POST',
      headers: {
        ...paypalAuthHeaders,
        'Authorization': 'Basic [REDACTED]'
      }
    });

    const paypalAuth = await fetch('https://api-m.paypal.com/v1/oauth2/token', {
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
    const paypalPlanId = requestedPlanId === 'premium-annual'
      ? Deno.env.get('PREMIUM_ANNUAL_PLAN_ID')
      : Deno.env.get('PREMIUM_PLAN_ID')
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

    // Try minimal subscription request first
    const subscriptionPayload = {
      plan_id: paypalPlanId,
      application_context: {
        return_url,
        cancel_url,
        shipping_preference: 'NO_SHIPPING'
      }
    };

    console.log('PayPal API Request:', {
      url: 'https://api-m.paypal.com/v1/billing/subscriptions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${paypalToken}`,
        'PayPal-Request-Id': crypto.randomUUID(),
        'Prefer': 'return=representation'
      },
      payload: subscriptionPayload
    });

    const subscription = await fetch('https://api-m.paypal.com/v1/billing/subscriptions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${paypalToken}`,
        'PayPal-Request-Id': crypto.randomUUID(),
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(subscriptionPayload)
    })

    let paypalSubscription
    const responseText = await subscription.text()

    try {
      paypalSubscription = JSON.parse(responseText)
    } catch (e) {
      console.error('Failed to parse PayPal response:', responseText)
      throw new Error('Invalid response from PayPal')
    }

    console.log('PayPal subscription response:', {
      status: subscription.status,
      statusText: subscription.statusText,
      headers: Object.fromEntries(subscription.headers.entries()),
      body: paypalSubscription
    });

    if (!subscription.ok) {
      let errorMessage = 'Failed to create PayPal subscription';
      
      // Log detailed error information
      const errorDetails = {
        status: subscription.status,
        statusText: subscription.statusText,
        response: paypalSubscription,
        responseHeaders: Object.fromEntries(subscription.headers.entries()),
        request: {
          payload: subscriptionPayload,
          url: 'https://api-m.paypal.com/v1/billing/subscriptions'
        }
      };
      console.error('PayPal API Error Details:', JSON.stringify(errorDetails, null, 2));

      // Extract detailed error message if available
      if (paypalSubscription.details && Array.isArray(paypalSubscription.details)) {
        errorMessage = paypalSubscription.details.map((detail: any) => {
          return `${detail.issue || ''}: ${detail.description || ''}`;
        }).join('; ');
      } else if (paypalSubscription.message) {
        errorMessage = paypalSubscription.message;
      } else if (paypalSubscription.error_description) {
        errorMessage = paypalSubscription.error_description;
      }

      throw new Error(`PayPal API Error: ${errorMessage}`);
    }

    // Validate subscription response
    if (!paypalSubscription.id) {
      console.error('Missing subscription ID in response:', paypalSubscription);
      throw new Error('PayPal response missing subscription ID');
    }

    if (!paypalSubscription.links || !Array.isArray(paypalSubscription.links)) {
      console.error('Missing links array in response:', paypalSubscription);
      throw new Error('PayPal response missing links array');
    }

    // Find the approval URL
    const approveLink = paypalSubscription.links.find((link: { rel: string; href: string }) => link.rel === 'approve');
    if (!approveLink || !approveLink.href) {
      console.error('No approval URL found in links:', paypalSubscription.links);
      throw new Error('PayPal response missing approval URL');
    }

    console.log('Found approval URL:', approveLink.href);

    // No need to create subscription record here
    // It will be created in activate-subscription after PayPal confirms

    return createResponse({
      subscriptionId: paypalSubscription.id,
      approvalUrl: paypalSubscription.links.find(
        (link: { rel: string }) => link.rel === 'approve'
      ).href
    });
  } catch (error) {
    return createResponse(
      { error: error.message },
      { status: 400 }
    );
  }
});