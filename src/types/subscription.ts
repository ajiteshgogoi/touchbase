export type SubscriptionStatus = 'active' | 'canceled' | 'expired';

export interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  billing_period: 'monthly' | 'annual';
  google_play_product_id: string | null;
  monthly_equivalent: number;
  contact_limit: number;
  features: string[];
}

export interface Subscription {
  valid_until: string | null;
  status: SubscriptionStatus;
  trial_end_date: string | null;
  subscription_plan_id: string;
  google_play_token?: string;
  paypal_subscription_id?: string;
  payment_method?: 'paypal' | 'google_play';
}