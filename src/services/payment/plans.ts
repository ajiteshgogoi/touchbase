import { SubscriptionPlan } from './types';

// Define default free plan constant
export const FREE_PLAN: SubscriptionPlan = {
  id: 'free',
  name: 'free',
  price: 0,
  billingPeriod: 'monthly',
  monthlyEquivalent: 0,
  contactLimit: 15,
  googlePlayProductId: null,
  features: [
    'Up to 15 contacts',
    'Push notifications',
    'Smart reminder system',
    '1-tap interaction logging',
    'Conversation starters',
    'Intelligent rescheduling for missed interactions'
  ]
};

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'free',
    name: 'free',
    price: 0,
    contactLimit: 15,
    billingPeriod: 'monthly',
    monthlyEquivalent: 0,
    googlePlayProductId: null,
    features: [
      'Up to 15 contacts',
      'Push notifications',
      'Smart reminder system',
      '1-tap interaction logging',
      'Conversation starters',
      'Intelligent rescheduling for missed interactions'
    ]
  },
  {
    id: 'premium',
    name: 'premium',
    price: 3,
    billingPeriod: 'monthly',
    monthlyEquivalent: 3,
    contactLimit: Infinity,
    googlePlayProductId: 'touchbase_premium', // Google Play product ID for monthly
    features: [
      'Unlimited contacts',
      'Push notifications',
      'Smart reminder system',
      '1-tap interaction logging',
      'Conversation starters',
      'Intelligent rescheduling for missed interactions',
      'Contact interaction history',
      'Advanced AI suggestions',
      'Relationship insights',
      'Data export to CSV',
      'AI chat assistant',
      'Priority support'
    ]
  },
  {
    id: 'premium-annual',
    name: 'premium',
    price: 27,
    billingPeriod: 'annual',
    monthlyEquivalent: 2.25, // 27/12 = 2.25, showing the monthly equivalent
    contactLimit: Infinity,
    googlePlayProductId: 'touchbase_premium_annual', // Google Play product ID for annual
    features: [
      'Unlimited contacts',
      'Push notifications',
      'Smart reminder system',
      '1-tap interaction logging',
      'Conversation starters',
      'Intelligent rescheduling for missed interactions',
      'Contact interaction history',
      'Advanced AI suggestions',
      'Relationship insights',
      'Data export to CSV',
      'AI chat assistant',
      'Priority support'
    ]
  }
];