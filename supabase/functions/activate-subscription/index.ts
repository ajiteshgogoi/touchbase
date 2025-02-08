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
    const { baToken } = await req.json()
    if (!baToken) throw new Error('No billing agreement token provided')

    // Get PayPal credentials
    const clientId = Deno.env.get('PAYPAL_CLIENT_ID')
    const clientSecret = Deno.env.get('PAYPAL_CLIENT_SECRET')
    if (!clientId || !clientSecret) {
      throw new Error('PayPal credentials not configured')
    }

    // Get PayPal access token
    const authResponse = await fetch('https://api-m.sandbox.paypal.com/v1/oauth2/token', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`
      },
      body: 'grant_type=client_credentials'
    });

    if (!authResponse.ok) {
      throw new Error('Failed to get PayPal access token')
    }

    const { access_token: paypalToken } = await authResponse.json()

    // Get subscription details from database
    const { data: subscription } = await supabaseClient
      .from('subscriptions')
      .select('paypal_subscription_id')
      .eq('user_id', user.id)
      .single()

    if (!subscription?.paypal_subscription_id) {
      throw new Error('No pending subscription found')
    }

    // Get subscription details from PayPal
    const subscriptionResponse = await fetch(
      `https://api-m.sandbox.paypal.com/v1/billing/subscriptions/${subscription.paypal_subscription_id}`,
      {
        headers: {
          'Authorization': `Bearer ${paypalToken}`,
          'Content-Type': 'application/json'
        }
      }
    )

    if (!subscriptionResponse.ok) {
      throw new Error('Failed to get subscription details from PayPal')
    }

    const subscriptionDetails = await subscriptionResponse.json()

    // Verify subscription is active
    if (subscriptionDetails.status !== 'ACTIVE') {
      throw new Error('Subscription is not active')
    }

    // Calculate valid_until date (1 month from now for monthly subscription)
    const validUntil = new Date()
    validUntil.setMonth(validUntil.getMonth() + 1)

    // Update subscription in database
    const { error: updateError } = await supabaseClient
      .from('subscriptions')
      .update({
        status: 'active',
        valid_until: validUntil.toISOString()
      })
      .eq('user_id', user.id)

    if (updateError) throw updateError

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