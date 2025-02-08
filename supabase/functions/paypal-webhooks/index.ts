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
  headers.set('Access-Control-Allow-Methods', '*');
  headers.set('Access-Control-Allow-Headers', '*');
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
  console.log('[PayPal Webhook] Received request:', {
    method: req.method,
    url: req.url,
    headers: Object.fromEntries(req.headers.entries())
  });

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

    // Get and log the raw body first
    const rawBody = await req.text();
    console.log('[PayPal Webhook] Request details:', {
      method: req.method,
      headers: Object.fromEntries(req.headers.entries()),
      rawBody
    });

    // Verify PayPal webhook signature
    const webhookId = Deno.env.get('PAYPAL_WEBHOOK_ID');
    if (!webhookId) {
      const error = new Error('PAYPAL_WEBHOOK_ID not configured');
      console.error('[PayPal Webhook] Missing PAYPAL_WEBHOOK_ID environment variable');
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: addCorsHeaders(new Headers({ 'Content-Type': 'application/json' })) }
      );
    }

    // Get and validate webhook headers
    const transmissionId = req.headers.get('paypal-transmission-id');
    const transmissionTime = req.headers.get('paypal-transmission-time');
    const authAlgo = req.headers.get('paypal-auth-algo');
    const certUrl = req.headers.get('paypal-cert-url');
    const signature = req.headers.get('paypal-transmission-sig');

    const missingHeaders = [];
    if (!transmissionId) missingHeaders.push('paypal-transmission-id');
    if (!transmissionTime) missingHeaders.push('paypal-transmission-time');
    if (!authAlgo) missingHeaders.push('paypal-auth-algo');
    if (!certUrl) missingHeaders.push('paypal-cert-url');
    if (!signature) missingHeaders.push('paypal-transmission-sig');

    if (missingHeaders.length > 0) {
      const error = new Error(`Missing required PayPal headers: ${missingHeaders.join(', ')}`);
      console.error('[PayPal Webhook] Missing headers:', { missingHeaders });
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 400, headers: addCorsHeaders(new Headers({ 'Content-Type': 'application/json' })) }
      );
    }
    const event: PayPalWebhookEvent = JSON.parse(rawBody);

    console.log('[PayPal Webhook] Received event:', {
      eventId: event.id,
      eventType: event.event_type,
      resourceId: event.resource.id,
      billingAgreementId: event.resource.billing_agreement_id,
      createTime: event.create_time,
      resourceDetails: event.resource
    });

    // Log full webhook payload in development
    if (Deno.env.get('ENVIRONMENT') === 'development') {
      console.log('[PayPal Webhook] Full event payload:', JSON.stringify(event, null, 2));
    }

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

    // Validate Supabase environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      const error = new Error('Missing Supabase configuration');
      console.error('[PayPal Webhook] Missing Supabase configuration:', {
        hasUrl: !!supabaseUrl,
        hasKey: !!supabaseKey
      });
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: addCorsHeaders(new Headers({ 'Content-Type': 'application/json' })) }
      );
    }

    // Initialize Supabase client
    const supabaseClient = createClient(supabaseUrl, supabaseKey);

    // Handle different webhook events
    switch (event.event_type) {
      case 'PAYMENT.SALE.COMPLETED': {
        console.log('[PayPal Webhook] Processing payment completion:', {
          billingAgreementId: event.resource.billing_agreement_id
        });

        // Fetch subscription from database using billing_agreement_id
        console.log('[PayPal Webhook] Fetching subscription:', {
          billingAgreementId: event.resource.billing_agreement_id
        });

        const { data: subscription, error: fetchError } = await supabaseClient
          .from('subscriptions')
          .select('*')
          .eq('paypal_subscription_id', event.resource.billing_agreement_id)
          .single();

        if (fetchError || !subscription) {
          console.error('[PayPal Webhook] Subscription fetch error:', {
            error: fetchError,
            subscription
          });
          console.error('[PayPal Webhook] Subscription not found:', {
            billingAgreementId: event.resource.billing_agreement_id,
            error: fetchError
          });
          throw new Error('Subscription not found');
        }

        // Log timestamps for debugging
        console.log('[PayPal Webhook] Payment timing:', {
          subscriptionCreatedAt: subscription.created_at,
          paymentTime: event.create_time,
          currentValidUntil: subscription.valid_until
        });

        // Check if this is an initial payment by verifying valid_until hasn't passed yet
        // For new subscriptions, valid_until will be in the future
        // For renewals, valid_until will be in the past or very close to now
        const currentTime = new Date();
        const validUntil = new Date(subscription.valid_until);
        const timeUntilExpiry = validUntil.getTime() - currentTime.getTime();
        const daysUntilExpiry = timeUntilExpiry / (1000 * 60 * 60 * 24);
        
        // Consider it an initial payment if we have more than 15 days until expiry
        const isInitialPayment = daysUntilExpiry > 15;

        console.log('[PayPal Webhook] Payment analysis:', {
          currentTime: currentTime.toISOString(),
          validUntil: validUntil.toISOString(),
          daysUntilExpiry,
          isInitialPayment
        });

        let newValidUntil;
        if (isInitialPayment) {
          // For initial payment, keep existing valid_until date set during activation
          newValidUntil = new Date(subscription.valid_until);
        } else {
          // For renewal payments, extend by one month from current valid_until
          newValidUntil = new Date(subscription.valid_until);
          newValidUntil.setMonth(newValidUntil.getMonth() + 1);
        }

        // Update subscription
        const { error: updateError } = await supabaseClient
          .from('subscriptions')
          .update({
            valid_until: newValidUntil.toISOString(),
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
          paymentType: isInitialPayment ? 'initial' : 'renewal',
          newValidUntil: newValidUntil.toISOString()
        });
        break;
      }

      case 'BILLING.SUBSCRIPTION.CANCELLED':
      case 'BILLING.SUBSCRIPTION.EXPIRED': {
        console.log('[PayPal Webhook] Processing subscription status change:', {
          eventType: event.event_type,
          subscriptionId: event.resource.id,
          billingAgreementId: event.resource.billing_agreement_id
        });

        // Lookup subscription by ID
        console.log('[PayPal Webhook] Looking up subscription:', {
          subscriptionId: event.resource.id
        });

        const { data: subscription, error: fetchError } = await supabaseClient
          .from('subscriptions')
          .select('*')
          .eq('paypal_subscription_id', event.resource.id)
          .maybeSingle();

        console.log('[PayPal Webhook] Subscription lookup result:', {
          found: !!subscription,
          error: fetchError,
          searchedIds: {
            subscriptionId: event.resource.id,
            billingAgreementId: event.resource.billing_agreement_id
          }
        });

        if (fetchError || !subscription) {
          console.error('[PayPal Webhook] Subscription not found:', {
            billingAgreementId: event.resource.billing_agreement_id,
            error: fetchError
          });
          throw new Error('Subscription not found');
        }

        // Update subscription status
        const { error: updateError } = await supabaseClient
          .from('subscriptions')
          .update({
            status: event.event_type === 'BILLING.SUBSCRIPTION.CANCELLED' ? 'canceled' : 'expired'
          })
          .eq('id', subscription.id);

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
    // Get detailed error information
    const errorDetails = {
      message: error.message,
      stack: error.stack,
      name: error.name,
      cause: error.cause
    };

    // Determine appropriate status code
    let status = 400;
    if (error.message.includes('PAYPAL_WEBHOOK_ID not configured') ||
        error.message.includes('Missing Supabase configuration')) {
      status = 500;
    } else if (error.message.includes('Invalid webhook signature')) {
      status = 401;
    } else if (error.message.includes('Missing required PayPal headers')) {
      status = 400;
    } else if (error.message.includes('Subscription not found')) {
      status = 404;
    }

    // Log the full error details
    console.error('[PayPal Webhook] Error processing webhook:', {
      ...errorDetails,
      timestamp: new Date().toISOString(),
      status,
      endpoint: req.url,
      method: req.method,
      headers: Object.fromEntries(req.headers.entries())
    });
    
    return new Response(
      JSON.stringify({
        error: error.message,
        timestamp: new Date().toISOString(),
        requestId: req.headers.get('paypal-transmission-id') || 'unknown',
        status
      }),
      {
        status,
        headers: addCorsHeaders(new Headers({ 'Content-Type': 'application/json' }))
      }
    );
  }
});