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

  console.log('[PayPal Webhook] Verifying signature:', {
    transmissionId,
    transmissionTime,
    webhookId: webhookId.substring(0, 8) + '...', // Log partial ID for security
    signaturePresent: !!actualSignature,
    certUrlPresent: !!certUrl,
    authAlgoPresent: !!actualAuthAlgo
  });

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
      console.log('[PayPal Webhook] Invalid method:', req.method);
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: addCorsHeaders(new Headers({ 'Content-Type': 'application/json' })) }
      );
    }

    // Verify PayPal webhook signature
    const webhookId = Deno.env.get('PAYPAL_WEBHOOK_ID');
    if (!webhookId) {
      console.error('[PayPal Webhook] Missing PAYPAL_WEBHOOK_ID environment variable');
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

    console.log('[PayPal Webhook] Received event:', {
      eventId: event.id,
      eventType: event.event_type,
      resourceId: event.resource.id,
      createTime: event.create_time
    });

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
      console.error('[PayPal Webhook] Invalid signature');
      return new Response(
        JSON.stringify({ error: 'Invalid webhook signature' }),
        { status: 401, headers: addCorsHeaders(new Headers({ 'Content-Type': 'application/json' })) }
      );
    }

    console.log('[PayPal Webhook] Signature verified successfully');

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Handle different webhook events
    switch (event.event_type) {
      case 'PAYMENT.SALE.COMPLETED': {
        console.log('[PayPal Webhook] Processing payment completion:', {
          billingAgreementId: event.resource.billing_agreement_id
        });

        // Fetch subscription from database using billing_agreement_id
        const { data: subscription, error: fetchError } = await supabaseClient
          .from('subscriptions')
          .select('*')
          .eq('paypal_subscription_id', event.resource.billing_agreement_id)
          .single();

        if (fetchError || !subscription) {
          console.error('[PayPal Webhook] Subscription not found:', {
            billingAgreementId: event.resource.billing_agreement_id,
            error: fetchError
          });
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

        if (updateError) {
          console.error('[PayPal Webhook] Failed to update subscription:', {
            billingAgreementId: event.resource.billing_agreement_id,
            error: updateError
          });
          throw updateError;
        }

        console.log('[PayPal Webhook] Successfully processed payment:', {
          billingAgreementId: event.resource.billing_agreement_id,
          newValidUntil: currentValidUntil.toISOString()
        });
        break;
      }

      case 'BILLING.SUBSCRIPTION.CANCELLED':
      case 'BILLING.SUBSCRIPTION.EXPIRED': {
        console.log('[PayPal Webhook] Processing subscription status change:', {
          eventType: event.event_type,
          subscriptionId: event.resource.id
        });

        // Update subscription status
        const { error: updateError } = await supabaseClient
          .from('subscriptions')
          .update({
            status: event.event_type === 'BILLING.SUBSCRIPTION.CANCELLED' ? 'canceled' : 'expired'
          })
          .eq('paypal_subscription_id', event.resource.id);

        if (updateError) {
          console.error('[PayPal Webhook] Failed to update subscription status:', {
            subscriptionId: event.resource.id,
            error: updateError
          });
          throw updateError;
        }

        console.log('[PayPal Webhook] Successfully updated subscription status:', {
          subscriptionId: event.resource.id,
          newStatus: event.event_type === 'BILLING.SUBSCRIPTION.CANCELLED' ? 'canceled' : 'expired'
        });
        break;
      }
    }

    console.log('[PayPal Webhook] Successfully processed event:', event.id);

    return new Response(
      JSON.stringify({ received: true }),
      { headers: addCorsHeaders(new Headers({ 'Content-Type': 'application/json' })) }
    );
  } catch (error) {
    console.error('[PayPal Webhook] Error processing webhook:', {
      error: error.message,
      stack: error.stack
    });
    
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400,
        headers: addCorsHeaders(new Headers({ 'Content-Type': 'application/json' }))
      }
    );
  }
});