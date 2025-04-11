export interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  contactLimit: number;
  features: string[];
  googlePlayProductId: string | null;
  billingPeriod: 'monthly' | 'annual';
  monthlyEquivalent: number;
}

export interface SubscriptionStatus {
  isPremium: boolean;
  currentPlan: SubscriptionPlan;
  validUntil: string | null;
  isOnTrial: boolean;
  trialDaysRemaining: number | null;
}

export type PaymentMethod = 'paypal' | 'google_play';