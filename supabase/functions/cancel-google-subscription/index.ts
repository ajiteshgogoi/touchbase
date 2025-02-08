import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { GoogleAuth } from 'https://esm.sh/google-auth-library@8.7.0'

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
    const { data: subscription } = await supabaseClient
      .from('subscriptions')
      .select('*')
      .eq('google_play_token', token)
      .single()

    if (!subscription) {
      throw new Error('Subscription not found')
    }

    // Get the product ID from the premium plan
    const premiumPlan = {
      googlePlayProductId: 'touchbase.pro.premium.monthly'
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
      throw new Error('Failed to cancel subscription with Google Play')
    }

    // Update subscription status in database
    const { error: updateError } = await supabaseClient
      .from('subscriptions')
      .update({
        status: 'cancelled',
        google_play_token: null,
      })
      .eq('google_play_token', token)

    if (updateError) throw updateError

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
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