export interface Subscription {
  valid_until: string | null;
  status: string;
  trial_end_date: string | null;
  plan_id: string;
  google_play_token?: string;
  payment_method?: 'paypal' | 'google_play';
}