export interface SubscriptionPlan {
  id: string;
  name: 'free' | 'premium';
  price: number;
  contactLimit: number;
  features: string[];
  googlePlayProductId?: string;
}

export interface SubscriptionStatus {
  isPremium: boolean;
  currentPlan: SubscriptionPlan;
  validUntil: string | null;
  isOnTrial: boolean;
  trialDaysRemaining: number | null;
}

export type PaymentMethod = 'paypal' | 'google_play';