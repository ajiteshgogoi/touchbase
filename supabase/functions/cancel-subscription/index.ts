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

    // Get user's subscription
    const { data: subscription } = await supabaseClient
      .from('subscriptions')
      .select('paypal_subscription_id')
      .eq('user_id', user.id)
      .single()

    if (!subscription?.paypal_subscription_id) {
      throw new Error('No active PayPal subscription found')
    }

    // Initialize PayPal client
    const paypalAuth = await fetch('https://api-m.sandbox.paypal.com/v1/oauth2/token', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${btoa(`${Deno.env.get('PAYPAL_CLIENT_ID')}:${Deno.env.get('PAYPAL_CLIENT_SECRET')}`)}`,
      },
      body: 'grant_type=client_credentials'
    })

    const { access_token: paypalToken } = await paypalAuth.json()

    // Cancel subscription with PayPal
    const response = await fetch(`https://api-m.sandbox.paypal.com/v1/billing/subscriptions/${subscription.paypal_subscription_id}/cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${paypalToken}`,
      },
      body: JSON.stringify({
        reason: 'Customer requested cancellation'
      })
    })

    if (!response.ok) {
      console.error('PayPal API Error:', await response.text())
      throw new Error('Failed to cancel PayPal subscription')
    }

    // Update subscription in database
    const { error: updateError } = await supabaseClient
      .from('subscriptions')
      .update({
        status: 'cancelled',
        paypal_subscription_id: null,
        valid_until: new Date().toISOString() // Immediate cancellation
      })
      .eq('user_id', user.id)

    if (updateError) throw updateError

    return new Response(
      JSON.stringify({ success: true }),
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