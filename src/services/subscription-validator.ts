import { supabase } from '../lib/supabase/client';
import { platform } from '../utils/platform';

export const subscriptionValidator = {
  async validateSubscriptionPlatform(): Promise<{ paypal_subscription_id?: string; google_play_token?: string }> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('No active session');

    const { data: subscription, error } = await supabase
      .from('subscriptions')
      .select('paypal_subscription_id, google_play_token')
      .eq('user_id', user.id)
      .single();

    if (error) throw error;
    if (!subscription) {
      throw new Error('No active subscription found');
    }

    if (subscription.paypal_subscription_id && platform.isAndroid()) {
      throw new Error('Please use the web app to manage your PayPal subscription');
    } 
    
    if (subscription.google_play_token && !platform.isAndroid()) {
      throw new Error('Please use the Android app to manage your Google Play subscription');
    }

    return subscription;
  }
};