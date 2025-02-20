import { supabase } from '../../lib/supabase/client';
import { PaymentMethod } from './types';
import { googlePlayService } from './google-play';
import { paypalService } from './paypal';
import { subscriptionService } from './subscription';
export { SUBSCRIPTION_PLANS } from './plans';

// Payment completion handling
type PaymentCallback = () => void;
const paymentCallbacks: PaymentCallback[] = [];

export const addPaymentCompletionListener = (callback: PaymentCallback): (() => void) => {
  paymentCallbacks.push(callback);
  return () => {
    const index = paymentCallbacks.indexOf(callback);
    if (index > -1) {
      paymentCallbacks.splice(index, 1);
    }
  };
};

export const notifyPaymentComplete = () => {
  paymentCallbacks.forEach(callback => callback());
  paymentCallbacks.length = 0;
};

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
        // Initialize polling for completion if using Google Play
        let pollAttempts = 0;
        const pollInterval = setInterval(() => {
          if (!document.querySelector('.PaymentActivity') || pollAttempts >= 60) {
            clearInterval(pollInterval);
            if (pollAttempts < 60) {
              notifyPaymentComplete();
            }
          }
          pollAttempts++;
        }, 500);

        // Ensure cleanup
        setTimeout(() => {
          clearInterval(pollInterval);
          document.body.classList.remove('modal-open');
        }, 30000);

        return googlePlayService.createSubscription(planId);
      } else {
        return paypalService.createSubscription(planId);
      }
    } catch (error) {
      console.error('Error creating subscription:', error);
      // Cleanup on error
      document.body.classList.remove('modal-open');
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