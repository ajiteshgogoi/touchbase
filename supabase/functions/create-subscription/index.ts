import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
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
    const { planId } = await req.json()
    if (planId !== 'premium') throw new Error('Invalid plan ID')

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

    // Create subscription with PayPal
    const subscription = await fetch('https://api-m.sandbox.paypal.com/v1/billing/subscriptions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${paypalToken}`,
        'PayPal-Request-Id': crypto.randomUUID(),
      },
      body: JSON.stringify({
        plan_id: Deno.env.get('PREMIUM_PLAN_ID'),
        subscriber: {
          name: {
            given_name: user.user_metadata?.full_name?.split(' ')[0] || 'Valued',
            surname: user.user_metadata?.full_name?.split(' ').slice(1).join(' ') || 'Customer'
          },
          email_address: user.email
        },
        application_context: {
          brand_name: 'TouchBase',
          locale: 'en-US',
          shipping_preference: 'NO_SHIPPING',
          user_action: 'SUBSCRIBE_NOW',
          payment_method: {
            payer_selected: 'PAYPAL',
            payee_preferred: 'IMMEDIATE_PAYMENT_REQUIRED'
          },
          return_url: `${Deno.env.get('APP_URL')}/settings?subscription=success`,
          cancel_url: `${Deno.env.get('APP_URL')}/settings?subscription=cancelled`
        }
      })
    })

    if (!subscription.ok) {
      console.error('PayPal API Error:', await subscription.text())
      throw new Error('Failed to create PayPal subscription')
    }

    const subscriptionData = await subscription.json()

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
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})