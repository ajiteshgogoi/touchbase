import { SubscriptionPlan } from './types';

// Define default free plan constant
export const FREE_PLAN: SubscriptionPlan = {
  id: 'free',
  name: 'free',
  price: 0,
  contactLimit: 15,
  features: [
    'Up to 15 contacts',
    'Push notifications',
    'Smart reminder system',
    '1-tap interaction logging',
    'Conversation prompt generator',
    'Intelligent rescheduling for missed interactions'
  ]
};

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'free',
    name: 'free',
    price: 0,
    contactLimit: 15,
    features: [
      'Up to 15 contacts',
      'Push notifications',
      'Smart reminder system',
      '1-tap interaction logging',
      'Conversation prompt generator',
      'Intelligent rescheduling for missed interactions'
    ]
  },
  {
    id: 'premium',
    name: 'premium',
    price: 3,
    contactLimit: Infinity,
    googlePlayProductId: 'touchbase_premium', // Google Play product ID
    features: [
      'Unlimited contacts',
      'Push notifications',
      'Smart reminder system',
      '1-tap interaction logging',
      'Conversation prompt generator',
      'Intelligent rescheduling for missed interactions',
      'Contact interaction history',      
      'Advanced AI suggestions',
      'Relationship insights',
      'Data export to CSV',
      'AI Chat Assistant',
      'Priority support'
    ]
  }
];