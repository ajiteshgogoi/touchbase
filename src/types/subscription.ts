export type SubscriptionStatus = 'active' | 'canceled' | 'expired';

export interface Subscription {
  valid_until: string | null;
  status: SubscriptionStatus;
  trial_end_date: string | null;
  plan_id: string;
  google_play_token?: string;
  payment_method?: 'paypal' | 'google_play';
}