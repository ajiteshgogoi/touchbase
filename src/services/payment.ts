import { supabase } from '../lib/supabase/client';

interface SubscriptionPlan {
  id: string;
  name: 'free' | 'premium';
  price: number;
  contactLimit: number;
  features: string[];
}

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'free',
    name: 'free',
    price: 0,
    contactLimit: 5,
    features: [
      'Up to 5 contacts',
      'Basic reminder system',
      'Email notifications',
      'Contact history'
    ]
  },
  {
    id: 'premium',
    name: 'premium',
    price: 5,
    contactLimit: Infinity,
    features: [
      'Unlimited contacts',
      'Advanced AI suggestions',
      'Priority support',
      'Custom reminder schedules',
      'Detailed analytics',
      'Export data'
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
      const response = await fetch('/api/create-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
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
          currentPlan: SUBSCRIPTION_PLANS[0],
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
          currentPlan: SUBSCRIPTION_PLANS[0],
          validUntil: null
        };
      }

      const isPremium = subscription.plan_id === 'premium' && 
        new Date(subscription.valid_until) > new Date();

      return {
        isPremium,
        currentPlan: SUBSCRIPTION_PLANS.find(plan => plan.id === subscription.plan_id) || SUBSCRIPTION_PLANS[0],
        validUntil: subscription.valid_until
      };
    } catch (error) {
      console.error('Error getting subscription status:', error);
      return {
        isPremium: false,
        currentPlan: SUBSCRIPTION_PLANS[0],
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