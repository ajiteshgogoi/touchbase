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
      console.log('Canceling subscription for payment method:', paymentMethod);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No active session');

      if (paymentMethod === 'google_play') {
        // Check if PaymentRequest API is available
        if (typeof PaymentRequest === 'undefined') {
          throw new Error('Google Play Billing is not available. If you installed from Play Store, please wait a few seconds and try again.');
        }
        await googlePlayService.cancelSubscription(session.access_token);
      } else {
        await paypalService.cancelSubscription(session.access_token);
      }
    } catch (error) {
      console.error('Error canceling subscription:', error);
      throw error;
    }
  }
};