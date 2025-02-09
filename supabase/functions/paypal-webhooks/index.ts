import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verify } from "https://deno.land/x/djwt@v2.8/mod.ts";

interface PayPalWebhookEvent {
  id: string;
  event_type: string;
  resource: {
    id: string;
    billing_agreement_id?: string;
    subscription_id?: string; // Some events use this instead of id
    status?: string;
    end_time?: string;
    amount?: {
      total: string;
      currency: string;
    };
  };
  create_time: string;
}

// Helper function to extract the PayPal subscription ID from various event formats
function getSubscriptionId(event: PayPalWebhookEvent): string {
  // For payment events, we want the billing_agreement_id since that's the subscription ID
  if (event.event_type === 'PAYMENT.SALE.COMPLETED') {
    return event.resource.billing_agreement_id || '';
  }

  // For cancellation events, use resource.id if it's in I-* format
  const resourceId = event.resource.id || event.resource.subscription_id;
  if (resourceId && resourceId.startsWith('I-')) {
    return resourceId;
  }
  return '';

  // Add clear logging for ID selection
  if (event.event_type === 'PAYMENT.SALE.COMPLETED') {
    console.log('[PayPal Webhook] Payment event - using billing_agreement_id:', {
      eventType: event.event_type,
      billingAgreementId: event.resource.billing_agreement_id,
      resourceId: event.resource.id
    });
  } else {
    console.log('[PayPal Webhook] Subscription event - using direct resource ID:', {
      eventType: event.event_type,
      resourceId: event.resource.id,
      subscriptionId: event.resource.subscription_id
    });
  }

  return subscriptionId;
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
  const clientId = Deno.env.get('PAYPAL_CLIENT_ID');
  const clientSecret = Deno.env.get('PAYPAL_CLIENT_SECRET');
  const baseUrl = Deno.env.get('PAYPAL_API_URL') || 'https://api-m.paypal.com';

  if (!clientId || !clientSecret) {
    throw new Error('PayPal API credentials not configured');
  }

  if (!transmissionId || !transmissionTime || !actualSignature || !certUrl || !actualAuthAlgo) {
    throw new Error('Missing required webhook headers');
  }

  console.log('[PayPal Webhook] Starting signature verification:', {
    transmissionId,
    transmissionTime,
    webhookId,
    signaturePresent: !!actualSignature,
    certUrlPresent: !!certUrl,
    authAlgoPresent: !!actualAuthAlgo,
    mode: baseUrl.includes('sandbox') ? 'sandbox' : 'production'
  });

  try {
    // Get access token
    const tokenResponse = await fetch(`${baseUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-Language': 'en_US',
        'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials'
    });

    const tokenResponseData = await tokenResponse.json();
    
    if (!tokenResponse.ok) {
      console.error('[PayPal Webhook] Token request failed:', {
        status: tokenResponse.status,
        response: tokenResponseData,
        url: `${baseUrl}/v1/oauth2/token`
      });
      throw new Error(`Failed to get PayPal access token: ${tokenResponse.status} - ${JSON.stringify(tokenResponseData)}`);
    }

    if (!tokenResponseData.access_token) {
      console.error('[PayPal Webhook] No access token in response:', tokenResponseData);
      throw new Error('No access token in PayPal response');
    }

    const access_token = tokenResponseData.access_token;

    const webhookEvent = JSON.parse(eventBody);
    // Ensure cert_url matches our environment
    let correctedCertUrl = certUrl;
    if (baseUrl.includes('sandbox') && !certUrl.includes('sandbox')) {
      correctedCertUrl = certUrl.replace('api.paypal.com', 'api.sandbox.paypal.com');
      console.log('[PayPal Webhook] Corrected cert_url to sandbox:', {
        original: certUrl,
        corrected: correctedCertUrl
      });
    }

    const requestBody = {
      auth_algo: actualAuthAlgo,
      cert_url: correctedCertUrl,
      transmission_id: transmissionId,
      transmission_sig: actualSignature,
      transmission_time: transmissionTime,
      webhook_id: webhookId,
      webhook_event: webhookEvent
    };

    console.log('[PayPal Webhook] Verification request:', {
      url: `${baseUrl}/v1/notifications/verify-webhook-signature`,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer [redacted]'
      },
      body: {
        ...requestBody,
        webhook_event: {
          id: webhookEvent.id,
          event_type: webhookEvent.event_type,
          resource_type: webhookEvent.resource_type
        }
      }
    });

    // Verify webhook signature
    const verifyResponse = await fetch(`${baseUrl}/v1/notifications/verify-webhook-signature`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${access_token}`,
      },
      body: JSON.stringify(requestBody)
    });

    const verifyResponseData = await verifyResponse.json();
    
    if (!verifyResponse.ok) {
      console.error('[PayPal Webhook] Verification request failed:', {
        status: verifyResponse.status,
        requestBody: {
          auth_algo: actualAuthAlgo,
          cert_url: certUrl,
          transmission_id: transmissionId,
          transmission_sig: actualSignature?.substring(0, 20) + '...',
          transmission_time: transmissionTime,
          webhook_id: webhookId
        },
        response: verifyResponseData,
        errorName: verifyResponseData.name,
        errorMessage: verifyResponseData.message,
        debugId: verifyResponseData.debug_id
      });

      if (verifyResponseData.name === 'WEBHOOK_VERIFICATION_ERROR') {
        throw new Error(`Invalid signature: ${verifyResponseData.message}`);
      } else if (verifyResponseData.name === 'WEBHOOK_EXPIRED') {
        throw new Error(`Webhook expired: ${verifyResponseData.message}`);
      } else if (verifyResponseData.name === 'WEBHOOK_INVALID_CERT_DOMAIN' ||
                 verifyResponseData.name === 'WEBHOOK_INVALID_CERT_TYPE') {
        throw new Error(`Invalid certificate: ${verifyResponseData.message}`);
      } else if (verifyResponseData.name === 'WEBHOOK_INVALID_SIGNATURE_TYPE') {
        throw new Error(`Invalid signature type: ${verifyResponseData.message}`);
      }

      return false;
    }

    const isValid = verifyResponseData.verification_status === 'SUCCESS';

    console.log('[PayPal Webhook] Verification result:', {
      status: verifyResponseData.verification_status,
      isValid,
      details: verifyResponseData,
      eventType: webhookEvent.event_type,
      eventId: webhookEvent.id
    });

    return isValid;
  } catch (error) {
    console.error('[PayPal Webhook] Verification error:', error);
    throw error;
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
        const paypalSubscriptionId = getSubscriptionId(event);
        let subscription = null;
        {
        try {
          console.log('[PayPal Webhook] Processing payment completion:', {
            paypalId: paypalSubscriptionId,
            eventType: event.event_type,
            resourceId: event.resource.id
          });

          // Try with trimmed ID first
          const { data: subscriptions, error: lookupError } = await supabaseClient
            .from('subscriptions')
            .select('*')
            .eq('paypal_subscription_id', paypalSubscriptionId.trim());

          subscription = subscriptions && subscriptions.length > 0 ? subscriptions[0] : null;

          if (!subscription) {
            // Try without trimming if initial lookup failed
            const { data: retrySubscriptions, error: retryError } = await supabaseClient
              .from('subscriptions')
              .select('*')
              .eq('paypal_subscription_id', paypalSubscriptionId);

            subscription = retrySubscriptions && retrySubscriptions.length > 0 ? retrySubscriptions[0] : null;

            if (!subscription) {
              console.error('[PayPal Webhook] All subscription lookups failed:', {
                paypalId: paypalSubscriptionId,
                trimmedAttempt: { found: false, error: lookupError },
                untrimmedAttempt: { found: false, error: retryError }
              });
              throw new Error(`Subscription not found for PayPal ID: ${paypalSubscriptionId}`);
            }
          }

          console.log('[PayPal Webhook] Found subscription:', {
            id: subscription.id,
            paypalId: subscription.paypal_subscription_id,
            status: subscription.status
          });

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

        // Update subscription using the PayPal subscription ID
        const updateData = {
          valid_until: newValidUntil.toISOString(),
          status: 'active'
        };

        // Log the update operation
        console.log('[PayPal Webhook] Updating subscription:', {
          paypalSubscriptionId,
          updateData,
          existingData: {
            id: subscription.id,
            paypalId: subscription.paypal_subscription_id,
            status: subscription.status
          }
        });

        const { error: updateError } = await supabaseClient
          .from('subscriptions')
          .update(updateData)
          .eq('id', subscription.id);

        if (updateError) {
          console.error('[PayPal Webhook] Failed to update subscription:', {
            id: subscription.id,
            paypalId: subscription.paypal_subscription_id,
            error: updateError
          });
          throw updateError;
        }

        console.log('[PayPal Webhook] Successfully processed payment:', {
          id: subscription.id,
          paypalId: paypalSubscriptionId,
          paymentType: isInitialPayment ? 'initial' : 'renewal',
          newValidUntil: newValidUntil.toISOString()
        });
      } catch (error) {
        console.error('[PayPal Webhook] Payment processing error:', {
          error,
          paypalId: paypalSubscriptionId
        });
        throw error;
      }
     }
     break;
     }

     case 'BILLING.SUBSCRIPTION.CANCELLED':
      case 'BILLING.SUBSCRIPTION.EXPIRED': {
        const paypalSubscriptionId = getSubscriptionId(event);

        console.log('[PayPal Webhook] Processing subscription status change:', {
          eventType: event.event_type,
          paypalId: paypalSubscriptionId,
          resourceId: event.resource.id
        });

        // Fetch subscription using the same lookup logic as payment handler
        let subscription = null;
        try {
          // Try with trimmed ID first
          const { data: subscriptions, error: lookupError } = await supabaseClient
            .from('subscriptions')
            .select('*')
            .eq('paypal_subscription_id', paypalSubscriptionId.trim());

          subscription = subscriptions && subscriptions.length > 0 ? subscriptions[0] : null;

          if (!subscription) {
            // Try without trimming if initial lookup failed
            const { data: retrySubscriptions, error: retryError } = await supabaseClient
              .from('subscriptions')
              .select('*')
              .eq('paypal_subscription_id', paypalSubscriptionId);

            subscription = retrySubscriptions && retrySubscriptions.length > 0 ? retrySubscriptions[0] : null;

            if (!subscription) {
              console.error('[PayPal Webhook] All subscription lookups failed for cancellation:', {
                paypalId: paypalSubscriptionId,
                trimmedAttempt: { found: false, error: lookupError },
                untrimmedAttempt: { found: false, error: retryError }
              });
              throw new Error(`Subscription not found for PayPal ID: ${paypalSubscriptionId}`);
            }
          }

          console.log('[PayPal Webhook] Found subscription for cancellation:', {
            id: subscription.id,
            paypalId: subscription.paypal_subscription_id,
            status: subscription.status
          });
        } catch (error) {
          console.error('[PayPal Webhook] Error looking up subscription:', error);
          throw error;
        }

        // We already have subscription from the lookup above, just continue with the update

        // Update subscription status
        const { error: updateError } = await supabaseClient
          .from('subscriptions')
          .update({
            status: event.event_type === 'BILLING.SUBSCRIPTION.CANCELLED' ? 'canceled' : 'expired',
            paypal_subscription_id: null  // Now safe to remove PayPal ID after webhook confirmation
          })
          .eq('id', subscription.id);

        if (updateError) {
          console.error('[PayPal Webhook] Failed to update subscription status:', {
            id: subscription.id,
            paypalId: paypalSubscriptionId,
            error: updateError
          });
          throw updateError;
        }

        console.log('[PayPal Webhook] Successfully updated subscription status:', {
          id: subscription.id,
          paypalId: subscription.paypal_subscription_id,
          oldStatus: subscription.status,
          newStatus: event.event_type === 'BILLING.SUBSCRIPTION.CANCELLED' ? 'canceled' : 'expired',
          eventType: event.event_type
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
        error.message.includes('Missing Supabase configuration') ||
        error.message.includes('PayPal API credentials not configured')) {
      status = 500;
    } else if (error.message.includes('Invalid webhook signature') ||
               error.message.includes('Failed to get PayPal access token')) {
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