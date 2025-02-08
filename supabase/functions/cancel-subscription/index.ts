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
  console.log('Received subscription cancellation request')
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: addCorsHeaders() })
  }

  try {
    // Initialize Supabase client
    console.log('Initializing Supabase client...')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('Missing Supabase credentials')
      throw new Error('Server configuration error')
    }

    const supabaseClient = createClient(supabaseUrl, supabaseKey)

    // Get the authorization header from the request
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.error('Missing authorization header')
      throw new Error('No authorization header')
    }

    // Get the JWT token from the authorization header
    console.log('Extracting JWT token...')
    const token = authHeader.replace('Bearer ', '')

    // Get the user from the JWT token
    console.log('Validating user token...')
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser(token)
    if (userError || !user) {
      console.error('User validation failed:', { error: userError })
      throw new Error('Invalid user token')
    }
    console.log('User validated successfully:', { userId: user.id })

    // Get user's subscription
    console.log('Fetching user subscription...', { userId: user.id })
    const { data: subscription, error: subscriptionError } = await supabaseClient
      .from('subscriptions')
      .select('paypal_subscription_id')
      .eq('user_id', user.id)
      .single()

    if (subscriptionError) {
      console.error('Failed to fetch subscription:', { error: subscriptionError })
      throw new Error('Failed to fetch subscription')
    }

    if (!subscription?.paypal_subscription_id) {
      console.error('No active subscription found:', { userId: user.id })
      throw new Error('No active PayPal subscription found')
    }
    console.log('Found active subscription:', {
      userId: user.id,
      subscriptionId: subscription.paypal_subscription_id
    })

    // Initialize PayPal client
    console.log('Initializing PayPal authentication...')
    const paypalAuth = await fetch('https://api-m.sandbox.paypal.com/v1/oauth2/token', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${btoa(`${Deno.env.get('PAYPAL_CLIENT_ID')}:${Deno.env.get('PAYPAL_CLIENT_SECRET')}`)}`,
      },
      body: 'grant_type=client_credentials'
    })

    if (!paypalAuth.ok) {
      const errorText = await paypalAuth.text()
      console.error('PayPal authentication failed:', { error: errorText })
      throw new Error('Failed to authenticate with PayPal')
    }

    const { access_token: paypalToken } = await paypalAuth.json()
    console.log('PayPal authentication successful')

    // Cancel subscription with PayPal
    console.log('Initiating PayPal subscription cancellation...', {
      subscriptionId: subscription.paypal_subscription_id
    })
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
      const errorText = await response.text()
      console.error('PayPal subscription cancellation failed:', {
        error: errorText,
        status: response.status,
        subscriptionId: subscription.paypal_subscription_id
      })
      throw new Error('Failed to cancel PayPal subscription')
    }
    console.log('PayPal subscription cancelled successfully', {
      subscriptionId: subscription.paypal_subscription_id
    })

    // Update subscription in database
    console.log('Updating subscription status in database...', { userId: user.id })
    const { error: updateError } = await supabaseClient
      .from('subscriptions')
      .update({
        status: 'cancelled',
        paypal_subscription_id: null,
        valid_until: new Date().toISOString() // Immediate cancellation
      })
      .eq('user_id', user.id)

    if (updateError) {
      console.error('Failed to update subscription in database:', {
        error: updateError,
        userId: user.id
      })
      throw updateError
    }
    console.log('Database update successful:', {
      userId: user.id,
      status: 'cancelled',
      validUntil: new Date().toISOString()
    })

    console.log('Subscription cancellation workflow completed successfully', { userId: user.id })
    return new Response(
      JSON.stringify({ success: true }),
      {
        headers: addCorsHeaders(new Headers({ 'Content-Type': 'application/json' })),
        status: 200,
      }
    )
  } catch (error) {
    console.error('Subscription cancellation failed:', {
      error: error.message,
      stack: error.stack,
      type: error.constructor.name
    })
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: addCorsHeaders(new Headers({ 'Content-Type': 'application/json' })),
        status: 400,
      }
    )
  }
})