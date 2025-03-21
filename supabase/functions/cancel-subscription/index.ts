import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { createResponse, handleOptions } from '../_shared/headers.ts';

serve(async (req) => {
  console.log('Received subscription cancellation request')
  
  if (req.method === 'OPTIONS') {
    return handleOptions();
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
    const paypalAuth = await fetch('https://api-m.paypal.com/v1/oauth2/token', {
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

    // Check subscription status with PayPal first
    console.log('Checking PayPal subscription status...', {
      subscriptionId: subscription.paypal_subscription_id
    })
    const statusResponse = await fetch(`https://api-m.paypal.com/v1/billing/subscriptions/${subscription.paypal_subscription_id}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${paypalToken}`,
      }
    })

    if (!statusResponse.ok) {
      const errorText = await statusResponse.text()
      console.error('Failed to get PayPal subscription status:', {
        error: errorText,
        status: statusResponse.status,
        subscriptionId: subscription.paypal_subscription_id
      })
      throw new Error('Failed to verify PayPal subscription status')
    }

    const subscriptionDetails = await statusResponse.json()
    console.log('PayPal subscription status:', {
      status: subscriptionDetails.status,
      subscriptionId: subscription.paypal_subscription_id
    })

    // If subscription is already cancelled/inactive, just update the database
    if (subscriptionDetails.status === 'CANCELLED' || subscriptionDetails.status === 'EXPIRED') {
      console.log('Subscription already cancelled in PayPal, updating database...', {
        subscriptionId: subscription.paypal_subscription_id
      })
    } else {
      // Attempt to cancel subscription with PayPal
      console.log('Initiating PayPal subscription cancellation...', {
        subscriptionId: subscription.paypal_subscription_id
      })
      const response = await fetch(`https://api-m.paypal.com/v1/billing/subscriptions/${subscription.paypal_subscription_id}/cancel`, {
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
        const errorJson = JSON.parse(errorText)
        
        // Handle case where subscription status is invalid for cancellation
        if (response.status === 422 && errorJson.details?.[0]?.issue === 'SUBSCRIPTION_STATUS_INVALID') {
          console.log('Subscription already in non-cancellable state:', {
            status: subscriptionDetails.status,
            subscriptionId: subscription.paypal_subscription_id
          })
        } else {
          console.error('PayPal subscription cancellation failed:', {
            error: errorText,
            status: response.status,
            subscriptionId: subscription.paypal_subscription_id
          })
          throw new Error('Failed to cancel PayPal subscription')
        }
      } else {
        console.log('PayPal subscription cancelled successfully', {
          subscriptionId: subscription.paypal_subscription_id
        })
      }
    }

    // Update subscription in database regardless of PayPal status
    console.log('Updating subscription status in database...', { userId: user.id })
    const { error: updateError } = await supabaseClient
      .from('subscriptions')
      .update({
        status: 'canceled'
        // Keep existing valid_until to maintain access until end of billing period
        // Don't null out paypal_subscription_id yet - we need it for webhook handling
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
      status: 'canceled',
      validUntil: new Date().toISOString()
    })

    console.log('Subscription cancellation workflow completed successfully', { userId: user.id })
    return createResponse({ success: true });
  } catch (error) {
    console.error('Subscription cancellation failed:', {
      error: error.message,
      stack: error.stack,
      type: error.constructor.name
    })
    return createResponse(
      { error: error.message },
      { status: 400 }
    );
  }
});