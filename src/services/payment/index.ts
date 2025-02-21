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

  async cancelSubscription(_paymentMethod?: PaymentMethod): Promise<void> {
    try {
      console.log('[Payment] Starting cancellation process');
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No active session');

      // Fetch subscription details
      console.log('[Payment] Fetching subscription details...');
      const { data: subscription, error: fetchError } = await supabase
        .from('subscriptions')
        .select('*')
        .single();

      console.log('[Payment] Fetched subscription:', {
        hasSubscription: Boolean(subscription),
        hasGooglePlayToken: Boolean(subscription?.google_play_token),
        hasPayPalId: Boolean(subscription?.paypal_subscription_id),
        status: subscription?.status
      });

      if (fetchError) {
        console.error('[Payment] Error fetching subscription:', fetchError);
        throw new Error('Failed to fetch subscription details');
      }

      if (!subscription) {
        throw new Error('No active subscription found');
      }

      // Determine payment method based on tokens in database
      if (subscription.google_play_token) {
        console.log('[Payment] Using Google Play cancellation');
        await googlePlayService.cancelSubscription();
      } else if (subscription.paypal_subscription_id) {
        console.log('[Payment] Using PayPal cancellation');
        await paypalService.cancelSubscription(session.access_token);
      } else {
        throw new Error('No valid payment method found for this subscription');
      }
    } catch (error) {
      console.error('Error canceling subscription:', error);
      throw error;
    }
  }
};