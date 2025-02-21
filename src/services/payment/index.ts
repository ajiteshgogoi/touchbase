import { supabase } from '../../lib/supabase/client';
import { PaymentMethod } from './types';
import { googlePlayService } from './google-play';
import { paypalService } from './paypal';
import { subscriptionService } from './subscription';
export { SUBSCRIPTION_PLANS } from './plans';

export const paymentService = {
  // Track Google Play Billing initialization state
  _isGooglePlayInitialized: false,

  // Initialize Google Play Billing
  async _initializeGooglePlayBilling(): Promise<void> {
    return googlePlayService._initializeGooglePlayBilling();
  },

  async createSubscription(planId: string, paymentMethod: PaymentMethod): Promise<string> {
    console.log('Creating subscription:', { planId, paymentMethod });
    try {
      if (paymentMethod === 'google_play') {
        return googlePlayService.createSubscription(planId);
      } else {
        return paypalService.createSubscription(planId);
      }
    } catch (error) {
      console.error('Error creating subscription:', error);
      throw error;
    }
  },

  async startTrial(): Promise<void> {
    return subscriptionService.startTrial();
  },

  async getSubscriptionStatus() {
    return subscriptionService.getSubscriptionStatus();
  },

  async cancelSubscription(paymentMethod: PaymentMethod): Promise<void> {
    try {
      console.log('[Payment] Starting cancellation with method:', paymentMethod);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No active session');

      // Fetch subscription details to verify active subscriptions
      console.log('[Payment] Fetching subscription details...');
      // Fetch full subscription details
      const { data: subscription, error: fetchError } = await supabase
        .from('subscriptions')
        .select('*')
        .single();

      console.log('[Payment] Fetched subscription:', {
        hasSubscription: Boolean(subscription),
        subscriptionData: {
          hasGooglePlayToken: Boolean(subscription?.google_play_token),
          hasPayPalId: Boolean(subscription?.paypal_subscription_id),
          status: subscription?.status,
          method: subscription?.payment_method
        },
        rawData: subscription,
        error: fetchError
      });

      if (fetchError) {
        console.error('[Payment] Error fetching subscription:', fetchError);
        throw new Error('Failed to fetch subscription details');
      }

      if (!subscription) {
        throw new Error('No active subscription found');
      }

      // Determine correct payment method using stored method first, then tokens
      const storedMethod = subscription.payment_method;
      const hasGooglePlay = Boolean(subscription.google_play_token);
      const hasPayPal = Boolean(subscription.paypal_subscription_id);

      console.log('[Payment] Payment method analysis:', {
        storedMethod,
        hasGooglePlay,
        hasPayPal,
        requestedMethod: paymentMethod,
        tokens: {
          googlePlay: subscription.google_play_token,
          paypal: subscription.paypal_subscription_id
        },
        status: subscription.status
      });

      // If stored method exists, ensure it matches requested method
      if (storedMethod && storedMethod !== paymentMethod) {
        console.error('[Payment] Method mismatch:', {
          stored: storedMethod,
          requested: paymentMethod
        });
        throw new Error(`Please cancel your ${storedMethod === 'google_play' ? 'Google Play' : 'PayPal'} subscription`);
      }

      // Fallback to token-based detection if no stored method
      if (!storedMethod) {
        if (hasGooglePlay && paymentMethod !== 'google_play') {
          console.error('[Payment] Token-based Google Play detection:', {
            detected: 'google_play',
            requested: paymentMethod,
            token: subscription.google_play_token
          });
          throw new Error('Please cancel your Google Play subscription');
        }

        if (hasPayPal && paymentMethod !== 'paypal') {
          console.error('[Payment] Token-based PayPal detection:', {
            detected: 'paypal',
            requested: paymentMethod,
            token: subscription.paypal_subscription_id
          });
          throw new Error('Please cancel your PayPal subscription');
        }
      }

      if (hasPayPal && paymentMethod !== 'paypal') {
        console.error('[Payment] Mismatch: Has PayPal ID but wrong payment method requested');
        throw new Error('Please cancel your PayPal subscription');
      }

      if (paymentMethod === 'google_play') {
        // Check if PaymentRequest API is available
        if (typeof PaymentRequest === 'undefined') {
          throw new Error('Google Play Billing is not available. If you installed from Play Store, please wait a few seconds and try again.');
        }
        await googlePlayService.cancelSubscription();
      } else {
        await paypalService.cancelSubscription(session.access_token);
      }
    } catch (error) {
      console.error('Error canceling subscription:', error);
      throw error;
    }
  }
};