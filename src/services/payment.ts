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
    'Contact history',
    'Push notifications',
    'Basic reminder system',
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
      'Contact history',
      'Push notifications',
      'Basic reminder system',
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
      'Contact history',
      'Push notifications',
      'Basic reminder system',
      '1-tap interaction logging',
      'Intelligent rescheduling for missed interactions',
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

  async getSubscriptionStatus(): Promise<SubscriptionStatus> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return {
          isPremium: false,
          currentPlan: FREE_PLAN,
          validUntil: null
        };
      }

      const { data: subscription, error } = await supabase
        .from('subscriptions')
        .select('plan_id, valid_until')
        .eq('user_id', user.id)
        .single();

      if (error || !subscription) {
        return {
          isPremium: false,
          currentPlan: FREE_PLAN,
          validUntil: null
        };
      }

      const currentPlan = SUBSCRIPTION_PLANS.find(plan =>
        plan.id === subscription.plan_id
      ) ?? FREE_PLAN;

      const isPremium = currentPlan.id === 'premium' &&
        subscription.valid_until &&
        new Date(subscription.valid_until) > new Date();

      return {
        isPremium,
        currentPlan,
        validUntil: subscription.valid_until
      };
    } catch (error) {
      console.error('Error getting subscription status:', error);
      return {
        isPremium: false,
        currentPlan: FREE_PLAN,
        validUntil: null
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