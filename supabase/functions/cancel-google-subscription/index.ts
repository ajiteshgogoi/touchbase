import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { GoogleAuth } from 'https://esm.sh/google-auth-library@8.7.0'

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

    // Get request body
    const { token } = await req.json()

    // Initialize Google Auth
    const auth = new GoogleAuth({
      credentials: {
        client_email: Deno.env.get('GOOGLE_SERVICE_ACCOUNT_EMAIL'),
        private_key: Deno.env.get('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY')?.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/androidpublisher'],
    })

    // Get access token
    const client = await auth.getClient()
    const accessToken = await client.getAccessToken()

    // Get subscription details
    const { data: subscription, error: fetchError } = await supabaseClient
      .from('subscriptions')
      .select('*')
      .eq('google_play_token', token)
      .single()

    if (fetchError || !subscription) {
      throw new Error('Subscription not found');
    }

    // Only proceed if subscription is active
    if (subscription.status !== 'active') {
      throw new Error('Subscription is not active');
    }

    // Get the product ID from the premium plan
    const premiumPlan = {
      googlePlayProductId: 'touchbase_premium'
    };

    // Cancel subscription with Google Play API
    const packageName = Deno.env.get('ANDROID_PACKAGE_NAME')
    const response = await fetch(
      `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/purchases/subscriptions/${premiumPlan.googlePlayProductId}/tokens/${token}:cancel`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken.token}`,
        },
      }
    )

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Google Play API error:', errorData);
      throw new Error(`Failed to cancel subscription with Google Play: ${errorData.error?.message || 'Unknown error'}`);
    }

    // Update subscription status in database
    const { error: updateError } = await supabaseClient
      .from('subscriptions')
      .update({
        status: 'canceled', // Using the correct status from schema
        // Keep google_play_token for potential UI needs
      })
      .eq('google_play_token', token)

    if (updateError) {
      console.error('Database update error:', updateError);
      throw updateError;
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: addCorsHeaders(new Headers({ 'Content-Type': 'application/json' })),
      status: 200,
    })
  } catch (error) {
    console.error('Cancellation error:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });

    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: error.stack || 'No stack trace available'
      }),
      {
        headers: addCorsHeaders(new Headers({ 'Content-Type': 'application/json' })),
        status: 400,
      }
    )
  }
})