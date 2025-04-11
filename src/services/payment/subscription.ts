import { supabase } from '../../lib/supabase/client';
import { SubscriptionStatus } from './types';
import { FREE_PLAN, SUBSCRIPTION_PLANS } from './plans';

export class SubscriptionService {
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
          subscription_plan_id: 'free',
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
  }

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
        .select(`
          subscription_plan_id,
          status,
          valid_until,
          trial_start_date,
          trial_end_date
        `)
        .eq('user_id', user.id)
        .single();

      if (error || !subscription) {
        // Create initial free subscription without trial
        const { error: createError } = await supabase
          .from('subscriptions')
          .insert({
            user_id: user.id,
            subscription_plan_id: 'free',
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
        plan.id === subscription.subscription_plan_id
      ) ?? FREE_PLAN;

      const now = new Date();
      const isPremium = (currentPlan.id === 'premium' || currentPlan.id === 'premium-annual') &&
        subscription.valid_until &&
        new Date(subscription.valid_until) > now;
      
      let isOnTrial = false;
      let trialDaysRemaining = null;
      
      if (subscription.trial_end_date && currentPlan.id === 'free') {
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
  }
}

export const subscriptionService = new SubscriptionService();