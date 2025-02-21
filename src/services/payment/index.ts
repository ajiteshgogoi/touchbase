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
      const { data: subscription, error: fetchError } = await supabase
        .from('subscriptions')
        .select('paypal_subscription_id, google_play_token, status')
        .single();

      console.log('[Payment] Fetched subscription:', {
        hasSubscription: Boolean(subscription),
        hasGooglePlayToken: Boolean(subscription?.google_play_token),
        hasPayPalId: Boolean(subscription?.paypal_subscription_id),
        status: subscription?.status,
        rawSubscription: subscription,
        error: fetchError
      });

      if (!subscription) {
        throw new Error('No active subscription found');
      }

      // Determine which subscription type is actually active
      const hasGooglePlay = Boolean(subscription.google_play_token);
      const hasPayPal = Boolean(subscription.paypal_subscription_id);

      console.log('[Payment] Payment method validation:', {
        hasGooglePlay,
        hasPayPal,
        requestedMethod: paymentMethod,
        googlePlayToken: subscription.google_play_token,
        paypalId: subscription.paypal_subscription_id,
        subscriptionStatus: subscription.status,
        typeCheck: {
          tokenType: typeof subscription.google_play_token,
          tokenLength: subscription.google_play_token?.length,
          isNullOrUndefined: subscription.google_play_token == null
        }
      });

      if (hasGooglePlay && paymentMethod !== 'google_play') {
        console.error('[Payment] Google Play mismatch:', {
          detected: 'google_play',
          requested: paymentMethod,
          token: subscription.google_play_token
        });
        throw new Error('Please cancel your Google Play subscription');
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