import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verify } from "https://deno.land/x/djwt@v2.8/mod.ts";

interface PayPalWebhookEvent {
  id: string;
  event_type: string;
  resource: {
    id: string;
    billing_agreement_id?: string;
    status?: string;
    end_time?: string;
    amount?: {
      total: string;
      currency: string;
    };
  };
  create_time: string;
}

function addCorsHeaders(headers: Headers = new Headers()) {
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'authorization, x-client-info, apikey, content-type, paypal-auth-algo, paypal-cert-url, paypal-transmission-id, paypal-transmission-sig, paypal-transmission-time');
  headers.set('Access-Control-Max-Age', '86400');
  headers.set('Access-Control-Allow-Credentials', 'true');
  return headers;
}

async function verifyPayPalWebhookSignature(
  transmissionId: string | null,
  transmissionTime: string | null,
  webhookId: string,
  eventBody: string,
  actualSignature: string | null,
  certUrl: string | null,
  actualAuthAlgo: string | null
): Promise<boolean> {
  // This is where you'd implement PayPal's webhook signature verification
  // Reference: https://developer.paypal.com/api/rest/webhooks/#link-verifypaypalwebhooksignature

  // For now, we'll assume the signature is valid if the webhookId matches
  // In production, you MUST implement proper signature verification
  const expectedWebhookId = Deno.env.get('PAYPAL_WEBHOOK_ID');
  return webhookId === expectedWebhookId;
}

serve(async (req) => {
  try {
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: addCorsHeaders() });
    }

    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: addCorsHeaders(new Headers({ 'Content-Type': 'application/json' })) }
      );
    }

    // Verify PayPal webhook signature
    const webhookId = Deno.env.get('PAYPAL_WEBHOOK_ID');
    if (!webhookId) {
      throw new Error('PAYPAL_WEBHOOK_ID not configured');
    }

    // Get webhook headers
    const transmissionId = req.headers.get('paypal-transmission-id');
    const transmissionTime = req.headers.get('paypal-transmission-time');
    const authAlgo = req.headers.get('paypal-auth-algo');
    const certUrl = req.headers.get('paypal-cert-url');
    const signature = req.headers.get('paypal-transmission-sig');

    // Get the raw body for signature verification
    const rawBody = await req.text();
    const event: PayPalWebhookEvent = JSON.parse(rawBody);

    // Verify webhook signature
    const isValid = await verifyPayPalWebhookSignature(
      transmissionId,
      transmissionTime,
      webhookId,
      rawBody,
      signature,
      certUrl,
      authAlgo
    );

    if (!isValid) {
      return new Response(
        JSON.stringify({ error: 'Invalid webhook signature' }),
        { status: 401, headers: addCorsHeaders(new Headers({ 'Content-Type': 'application/json' })) }
      );
    }

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Handle different webhook events
    switch (event.event_type) {
      case 'PAYMENT.SALE.COMPLETED': {
        // Fetch subscription from database using billing_agreement_id
        const { data: subscription, error: fetchError } = await supabaseClient
          .from('subscriptions')
          .select('*')
          .eq('paypal_subscription_id', event.resource.billing_agreement_id)
          .single();

        if (fetchError || !subscription) {
          throw new Error('Subscription not found');
        }

        // Calculate new valid_until date (1 month from current valid_until)
        const currentValidUntil = new Date(subscription.valid_until);
        currentValidUntil.setMonth(currentValidUntil.getMonth() + 1);

        // Update subscription
        const { error: updateError } = await supabaseClient
          .from('subscriptions')
          .update({
            valid_until: currentValidUntil.toISOString(),
            status: 'active'
          })
          .eq('paypal_subscription_id', event.resource.billing_agreement_id);

        if (updateError) throw updateError;
        break;
      }

      case 'BILLING.SUBSCRIPTION.CANCELLED':
      case 'BILLING.SUBSCRIPTION.EXPIRED': {
        // Update subscription status
        const { error: updateError } = await supabaseClient
          .from('subscriptions')
          .update({
            status: event.event_type === 'BILLING.SUBSCRIPTION.CANCELLED' ? 'canceled' : 'expired'
          })
          .eq('paypal_subscription_id', event.resource.id);

        if (updateError) throw updateError;
        break;
      }
    }

    return new Response(
      JSON.stringify({ received: true }),
      { headers: addCorsHeaders(new Headers({ 'Content-Type': 'application/json' })) }
    );
  } catch (error) {
    console.error('Webhook error:', error);
    
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400,
        headers: addCorsHeaders(new Headers({ 'Content-Type': 'application/json' }))
      }
    );
  }
});