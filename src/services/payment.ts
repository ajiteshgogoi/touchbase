import { supabase } from '../lib/supabase/client';
import { platform } from '../utils/platform';

interface SubscriptionPlan {
  id: string;
  name: 'free' | 'premium';
  price: number;
  contactLimit: number;
  features: string[];
  googlePlayProductId?: string; // Product ID for Google Play Billing
}

// Define default free plan constant
const FREE_PLAN: SubscriptionPlan = {
  id: 'free',
  name: 'free',
  price: 0,
  contactLimit: 7,
  features: [
    'Up to 7 contacts',
    'Push notifications',
    'Daily reminder system',
    '1-tap interaction logging',
    'Intelligent rescheduling for missed interactions'
  ]
};

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'free',
    name: 'free',
    price: 0,
    contactLimit: 7,
    features: [
      'Up to 7 contacts',
      'Push notifications',
      'Daily reminder system',
      '1-tap interaction logging',
      'Intelligent rescheduling for missed interactions'
    ]
  },
  {
    id: 'premium',
    name: 'premium',
    price: 5,
    contactLimit: Infinity,
    googlePlayProductId: 'touchbase.pro.premium.monthly', // Add your actual Google Play product ID
    features: [
      'Unlimited contacts',
      'Push notifications',
      'Daily reminder system',
      '1-tap interaction logging',
      'Intelligent rescheduling for missed interactions',
      'Contact interaction history',      
      'Advanced AI suggestions',
      'Detailed analytics',
      'Priority support'
    ]
  }
];

interface SubscriptionStatus {
  isPremium: boolean;
  currentPlan: SubscriptionPlan;
  validUntil: string | null;
  isOnTrial: boolean;
  trialDaysRemaining: number | null;
}

declare global {
  interface Window {
    google?: {
      payments: {
        subscriptions: {
          subscribe(sku: string): Promise<{ purchaseToken: string }>;
          acknowledge(token: string): Promise<void>;
          cancel(token: string): Promise<void>;
        };
      };
    };
  }
}

export const paymentService = {
  async createSubscription(planId: string): Promise<string> {
    try {
      if (platform.isAndroid()) {
        return this._createGooglePlaySubscription(planId);
      } else {
        return this._createPayPalSubscription(planId);
      }
    } catch (error) {
      console.error('Error creating subscription:', error);
      throw error;
    }
  },

  async _createGooglePlaySubscription(planId: string): Promise<string> {
    try {
      const plan = SUBSCRIPTION_PLANS.find(p => p.id === planId);
      if (!plan?.googlePlayProductId) {
        throw new Error('Invalid plan for Google Play Billing');
      }

      if (!window.google?.payments?.subscriptions) {
        throw new Error('Google Play Billing not available');
      }

      const { purchaseToken } = await window.google.payments.subscriptions
        .subscribe(plan.googlePlayProductId);

      // Acknowledge the purchase
      await window.google.payments.subscriptions.acknowledge(purchaseToken);

      // Update subscription in backend
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No active session');

      const response = await fetch('/api/verify-google-purchase', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ 
          purchaseToken,
          productId: plan.googlePlayProductId
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to verify purchase');
      }

      return purchaseToken;
    } catch (error) {
      console.error('Error creating Google Play subscription:', error);
      throw error;
    }
  },

  async _createPayPalSubscription(planId: string): Promise<string> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No active session');

      const response = await fetch('/api/create-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ planId }),
      });

      if (!response.ok) {
        throw new Error('Failed to create subscription');
      }

      const data = await response.json();
      return data.subscriptionId;
    } catch (error) {
      console.error('Error creating PayPal subscription:', error);
      throw error;
    }
  },

  async startTrial(): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No active session');

      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (subscription?.trial_start_date) {
        throw new Error('Trial period already used');
      }

      const trialStartDate = new Date();
      const trialEndDate = new Date(trialStartDate);
      trialEndDate.setDate(trialEndDate.getDate() + 14); // 14 day trial

      const { error } = await supabase
        .from('subscriptions')
        .upsert({
          user_id: user.id,
          plan_id: 'free',
          status: 'active',
          valid_until: trialEndDate.toISOString(),
          trial_start_date: trialStartDate.toISOString(),
          trial_end_date: trialEndDate.toISOString()
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;
    } catch (error) {
      console.error('Error starting trial:', error);
      throw error;
    }
  },

  async getSubscriptionStatus(): Promise<SubscriptionStatus> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return {
          isPremium: false,
          currentPlan: FREE_PLAN,
          validUntil: null,
          isOnTrial: false,
          trialDaysRemaining: null
        };
      }

      const { data: subscription, error } = await supabase
        .from('subscriptions')
        .select('plan_id, valid_until, trial_start_date, trial_end_date')
        .eq('user_id', user.id)
        .single();

      if (error || !subscription) {
        // Create initial free subscription without trial
        const { error: createError } = await supabase
          .from('subscriptions')
          .insert({
            user_id: user.id,
            plan_id: 'free',
            status: 'active',
            valid_until: new Date('2200-01-01').toISOString(), // Far future date for free plan
            trial_start_date: null,
            trial_end_date: null
          });

        if (createError) throw createError;
        
        return {
          isPremium: false,
          currentPlan: FREE_PLAN,
          validUntil: null,
          isOnTrial: false,
          trialDaysRemaining: null
        };
      }

      const currentPlan = SUBSCRIPTION_PLANS.find(plan =>
        plan.id === subscription.plan_id
      ) ?? FREE_PLAN;

      const isPremium = currentPlan.id === 'premium' &&
        subscription.valid_until &&
        new Date(subscription.valid_until) > new Date();

      let isOnTrial = false;
      let trialDaysRemaining = null;

      if (subscription.trial_end_date) {
        const now = new Date();
        const trialEnd = new Date(subscription.trial_end_date);
        
        if (trialEnd > now) {
          isOnTrial = true;
          const diffTime = Math.abs(trialEnd.getTime() - now.getTime());
          trialDaysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        }
      }

      return {
        isPremium,
        currentPlan,
        validUntil: subscription.valid_until,
        isOnTrial,
        trialDaysRemaining
      };
    } catch (error) {
      console.error('Error getting subscription status:', error);
      return {
        isPremium: false,
        currentPlan: FREE_PLAN,
        validUntil: null,
        isOnTrial: false,
        trialDaysRemaining: null
      };
    }
  },

  async cancelSubscription(): Promise<void> {
    try {
      if (platform.isAndroid()) {
        await this._cancelGooglePlaySubscription();
      } else {
        await this._cancelPayPalSubscription();
      }
    } catch (error) {
      console.error('Error canceling subscription:', error);
      throw error;
    }
  },

  async _cancelGooglePlaySubscription(): Promise<void> {
    try {
      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('google_play_token')
        .single();

      if (!subscription?.google_play_token) {
        throw new Error('No active Google Play subscription');
      }

      await window.google?.payments.subscriptions.cancel(subscription.google_play_token);

      await fetch('/api/cancel-google-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ token: subscription.google_play_token })
      });
    } catch (error) {
      console.error('Error canceling Google Play subscription:', error);
      throw error;
    }
  },

  async _cancelPayPalSubscription(): Promise<void> {
    try {
      const response = await fetch('/api/cancel-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error('Failed to cancel subscription');
      }
    } catch (error) {
      console.error('Error canceling PayPal subscription:', error);
      throw error;
    }
  }
};