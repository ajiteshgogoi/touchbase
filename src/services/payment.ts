import { supabase } from '../lib/supabase/client';
import { platform } from '../utils/platform';

interface SubscriptionPlan {
  id: string;
  name: 'free' | 'premium';
  price: number;
  contactLimit: number;
  features: string[];
  googlePlayProductId?: string; // Product ID for Google Play Billing
}

// Define default free plan constant
const FREE_PLAN: SubscriptionPlan = {
  id: 'free',
  name: 'free',
  price: 0,
  contactLimit: 15,
  features: [
    'Up to 15 contacts',
    'Push notifications',
    'Daily reminder system',
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
      'Daily reminder system',
      '1-tap interaction logging',
      'Conversation prompt generator',
      'Intelligent rescheduling for missed interactions'
    ]
  },
  {
    id: 'premium',
    name: 'premium',
    price: 5,
    contactLimit: Infinity,
    googlePlayProductId: 'touchbase_premium', // Google Play product ID
    features: [
      'Unlimited contacts',
      'Push notifications',
      'Daily reminder system',
      '1-tap interaction logging',
      'Conversation prompt generator',
      'Intelligent rescheduling for missed interactions',
      'Contact interaction history',      
      'Advanced AI suggestions',
      'Detailed analytics',
      'Priority support'
    ]
  }
];

interface SubscriptionStatus {
  isPremium: boolean;
  currentPlan: SubscriptionPlan;
  validUntil: string | null;
  isOnTrial: boolean;
  trialDaysRemaining: number | null;
}

declare global {
  interface Window {
    getDigitalGoodsService?: (paymentMethod: string) => Promise<any>;
  }
}

type PaymentMethod = 'paypal' | 'google_play';

export const paymentService = {
  // Track Google Play Billing service
  _googlePlayBillingService: null as any,

  // Initialize Google Play Billing - should be called before any Google Play operations
  async _initializeGooglePlayBilling(): Promise<void> {
    console.log('Initializing Google Play Billing...');
    try {
      if (!window.getDigitalGoodsService) {
        console.error('Digital Goods API not found in window object');
        throw new Error('Digital Goods API not available');
      }

      console.log('Getting Digital Goods Service for Google Play Billing...');
      this._googlePlayBillingService = await window.getDigitalGoodsService('https://play.google.com/billing');
      
      if (!this._googlePlayBillingService) {
        console.error('Failed to get Digital Goods Service - service is null');
        throw new Error('Failed to initialize Google Play Billing service');
      }

      console.log('Successfully initialized Google Play Billing service:', this._googlePlayBillingService);
    } catch (error) {
      console.error('Error initializing Google Play Billing:', error);
      // Log more details about the error
      if (error instanceof Error) {
        console.log('Error details:', {
          message: error.message,
          name: error.name,
          stack: error.stack
        });
      }
      throw new Error('Google Play Billing initialization failed. If you installed from Play Store, please try again in a few seconds.');
    }
  },

  async createSubscription(planId: string, paymentMethod: PaymentMethod): Promise<string> {
    try {
      if (paymentMethod === 'google_play') {
        console.log('Creating Google Play subscription for plan:', planId);
        // Check if Google Play Billing is available
        const isAvailable = await platform.isGooglePlayBillingAvailable();
        console.log('Google Play Billing available:', isAvailable);
        
        if (!isAvailable) {
          throw new Error('Google Play Billing is not available. If you installed from Play Store, please wait a few seconds and try again.');
        }
        return this._createGooglePlaySubscription(planId);
      } else {
        console.log('Creating PayPal subscription for plan:', planId);
        return this._createPayPalSubscription(planId);
      }
    } catch (error) {
      console.error('Error creating subscription:', error);
      throw error;
    }
  },

  async _createGooglePlaySubscription(planId: string): Promise<string> {
    try {
      console.log('Starting Google Play subscription creation for plan:', planId);
      
      // Find the plan and verify it has a Google Play product ID
      const plan = SUBSCRIPTION_PLANS.find(p => p.id === planId);
      if (!plan?.googlePlayProductId) {
        console.error('Invalid or missing Google Play product ID for plan:', planId);
        throw new Error('Invalid plan for Google Play Billing');
      }

      console.log('Using Google Play product ID:', plan.googlePlayProductId);

      // Initialize Google Play Billing if not already initialized
      if (!this._googlePlayBillingService) {
        console.log('Google Play Billing service not initialized, initializing now...');
        await this._initializeGooglePlayBilling();
      }

      // Get the product details
      console.log('Fetching product details from Google Play...');
      const [item] = await this._googlePlayBillingService.getDetails([plan.googlePlayProductId]);
      console.log('Product details received:', item);

      if (!item) {
        console.error('Product not found in Google Play:', plan.googlePlayProductId);
        throw new Error('Product not found in Google Play');
      }

      // Start the purchase flow
      console.log('Starting purchase flow...');
      const payment = await this._googlePlayBillingService.purchase(item);
      console.log('Purchase response:', payment);

      if (!payment) {
        console.error('Purchase failed or was cancelled');
        throw new Error('Purchase failed or was cancelled');
      }

      // Update subscription in backend
      console.log('Updating subscription in backend...');
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.error('No active session found');
        throw new Error('No active session');
      }

      console.log('Verifying purchase with backend...');
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-google-purchase`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ 
          purchaseToken: payment.purchaseToken,
          productId: plan.googlePlayProductId
        }),
      });

      if (!response.ok) {
        console.error('Backend verification failed:', await response.text());
        throw new Error('Failed to verify purchase');
      }

      console.log('Successfully created Google Play subscription');
      return payment.purchaseToken;
    } catch (error) {
      console.error('Error creating Google Play subscription:', error);
      // Log more details about the error
      if (error instanceof Error) {
        console.log('Error details:', {
          message: error.message,
          name: error.name,
          stack: error.stack
        });
      }
      throw error;
    }
  },

  async _createPayPalSubscription(planId: string): Promise<string> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No active session');

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-subscription`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ planId }),
      });

      const responseData = await response.json();
      
      if (!response.ok) {
        throw new Error(responseData.error || 'Failed to create subscription');
      }

      // Log the response for debugging
      console.log('PayPal subscription response:', responseData);

      const { subscriptionId, approvalUrl } = responseData;
      
      if (!approvalUrl) {
        throw new Error('No approval URL received from PayPal');
      }

      // Log before redirect
      console.log('Redirecting to PayPal approval URL:', approvalUrl);
      
      // Redirect to PayPal approval page
      window.location.href = approvalUrl;
      return subscriptionId;
    } catch (error) {
      console.error('Error creating PayPal subscription:', error);
      throw error;
    }
  },

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
          plan_id: 'free',
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
  },

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
        .select('plan_id, status, valid_until, trial_start_date, trial_end_date')
        .eq('user_id', user.id)
        .single();

      if (error || !subscription) {
        // Create initial free subscription without trial
        const { error: createError } = await supabase
          .from('subscriptions')
          .insert({
            user_id: user.id,
            plan_id: 'free',
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
        plan.id === subscription.plan_id
      ) ?? FREE_PLAN;

      const now = new Date();
      const isPremium = currentPlan.id === 'premium' &&
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
  },

  async cancelSubscription(paymentMethod: PaymentMethod): Promise<void> {
    try {
      console.log('Canceling subscription for payment method:', paymentMethod);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No active session');

      if (paymentMethod === 'google_play') {
        if (!this._googlePlayBillingService) {
          console.log('Initializing Google Play Billing for cancellation...');
          await this._initializeGooglePlayBilling();
        }
        await this._cancelGooglePlaySubscription(session.access_token);
      } else {
        await this._cancelPayPalSubscription(session.access_token);
      }
    } catch (error) {
      console.error('Error canceling subscription:', error);
      throw error;
    }
  },

  async _cancelGooglePlaySubscription(accessToken: string): Promise<void> {
    try {
      console.log('Starting Google Play subscription cancellation...');
      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('google_play_token')
        .single();

      if (!subscription?.google_play_token) {
        console.error('No Google Play token found in subscription');
        throw new Error('No active Google Play subscription');
      }

      console.log('Found Google Play token:', subscription.google_play_token);

      if (this._googlePlayBillingService) {
        console.log('Acknowledging cancellation with Google Play...');
        await this._googlePlayBillingService.acknowledge(subscription.google_play_token);
        console.log('Successfully acknowledged cancellation');
      } else {
        console.error('Google Play Billing service not initialized');
        throw new Error('Google Play Billing service not initialized');
      }

      console.log('Notifying backend of cancellation...');
      await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cancel-google-subscription`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({ token: subscription.google_play_token })
      });

      console.log('Successfully cancelled Google Play subscription');
    } catch (error) {
      console.error('Error canceling Google Play subscription:', error);
      // Log more details about the error
      if (error instanceof Error) {
        console.log('Error details:', {
          message: error.message,
          name: error.name,
          stack: error.stack
        });
      }
      throw error;
    }
  },

  async _cancelPayPalSubscription(accessToken: string): Promise<void> {
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cancel-subscription`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        }
      });

      const responseData = await response.json();
      
      if (!response.ok) {
        throw new Error(responseData.error || 'Failed to cancel subscription');
      }

      // Handle PayPal redirect URL if provided in response
      if (responseData.redirectUrl) {
        window.location.href = responseData.redirectUrl;
        return;
      }
    } catch (error) {
      console.error('Error canceling PayPal subscription:', error);
      throw error;
    }
  }
};