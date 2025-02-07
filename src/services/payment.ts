import { supabase } from '../lib/supabase/client';

interface SubscriptionPlan {
  id: string;
  name: 'free' | 'premium';
  price: number;
  contactLimit: number;
  features: string[];
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

export const paymentService = {
  async createPayPalSubscription(planId: string): Promise<string> {
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
      console.error('Error creating subscription:', error);
      throw error;
    }
  },

  async startTrial(): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No active session');

      // Check if user already has a subscription record
      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('trial_start_date')
        .eq('user_id', user.id)
        .single();

      // Don't start trial if user already used it
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
            valid_until: null,
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
      console.error('Error canceling subscription:', error);
      throw error;
    }
  }
};