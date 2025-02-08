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

interface PayPalVerifyWebhookResponse {
  verification_status: "SUCCESS" | "FAILURE";
}

function addCorsHeaders(headers: Headers = new Headers()) {
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', '*');
  headers.set('Access-Control-Allow-Headers', '*');
  headers.set('Access-Control-Max-Age', '86400');
  headers.set('Access-Control-Allow-Credentials', 'true');
  return headers;
}

async function getPayPalAccessToken(): Promise<string> {
  const clientId = Deno.env.get('PAYPAL_CLIENT_ID');
  const clientSecret = Deno.env.get('PAYPAL_CLIENT_SECRET');
  const isProduction = Deno.env.get('PAYPAL_ENV') === 'production';
  
  if (!clientId || !clientSecret) {
    throw new Error('PayPal client credentials not configured');
  }

  const auth = btoa(`${clientId}:${clientSecret}`);
  const url = isProduction
    ? 'https://api.paypal.com/v1/oauth2/token'
    : 'https://api.sandbox.paypal.com/v1/oauth2/token';

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials'
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get PayPal access token: ${error}`);
  }

  const data = await response.json();
  return data.access_token;
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
  if (!transmissionId || !transmissionTime || !actualSignature || !certUrl || !actualAuthAlgo) {
    return false;
  }

  const isProduction = Deno.env.get('PAYPAL_ENV') === 'production';
  const verifyUrl = isProduction
    ? 'https://api.paypal.com/v1/notifications/verify-webhook-signature'
    : 'https://api.sandbox.paypal.com/v1/notifications/verify-webhook-signature';

  try {
    const accessToken = await getPayPalAccessToken();

    const verificationData = {
      transmission_id: transmissionId,
      transmission_time: transmissionTime,
      cert_url: certUrl,
      auth_algo: actualAuthAlgo,
      transmission_sig: actualSignature,
      webhook_id: webhookId,
      webhook_event: JSON.parse(eventBody)
    };

    console.log('[PayPal Webhook] Verifying signature with PayPal:', {
      transmissionId,
      transmissionTime,
      webhookId: webhookId.substring(0, 8) + '...', // Log partial ID for security
      signaturePresent: !!actualSignature,
      certUrlPresent: !!certUrl,
      authAlgoPresent: !!actualAuthAlgo
    });

    const response = await fetch(verifyUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(verificationData)
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[PayPal Webhook] Verification request failed:', error);
      return false;
    }

    const result = await response.json() as PayPalVerifyWebhookResponse;
    return result.verification_status === 'SUCCESS';
  } catch (error) {
    console.error('[PayPal Webhook] Error verifying signature:', error);
    return false;
  }
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

    // Get the raw body first to ensure we can read it
    const rawBody = await req.text();
    console.log('[PayPal Webhook] Raw request body:', rawBody);

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

        // Fetch and update subscription using billing_agreement_id
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