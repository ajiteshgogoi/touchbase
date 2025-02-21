import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useStore } from '../../stores/useStore';
import { CheckIcon } from '@heroicons/react/24/outline';
import { formatDateWithTimezone } from '../../utils/date';
import { PaymentMethodModal } from '../shared/PaymentMethodModal';
import { paymentService, SUBSCRIPTION_PLANS } from '../../services/payment';
import { paymentEvents, PAYMENT_EVENTS } from '../../services/payment/payment-events';

import type { Subscription } from '../../types/subscription';

interface Props {
  isPremium: boolean;
  subscription: Subscription | null | undefined;
  timezone: string;
}

type PaymentMethod = 'paypal' | 'google_play';

export const SubscriptionSettings = ({ isPremium, subscription, timezone }: Props) => {
  const queryClient = useQueryClient();
  const { user } = useStore();
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const selectedPlan = isPremium ? 'premium' : 'free';

  useEffect(() => {
    const handlePaymentFlowStart = () => {
      setIsSubscribing(true);
    };

    const handleGooglePlayUIReady = () => {
      setIsSubscribing(false);
      setIsModalOpen(false);
    };

    paymentEvents.on(PAYMENT_EVENTS.PAYMENT_FLOW_START, handlePaymentFlowStart);
    paymentEvents.on(PAYMENT_EVENTS.GOOGLE_PLAY_UI_READY, handleGooglePlayUIReady);
    
    return () => {
      paymentEvents.off(PAYMENT_EVENTS.PAYMENT_FLOW_START, handlePaymentFlowStart);
      paymentEvents.off(PAYMENT_EVENTS.GOOGLE_PLAY_UI_READY, handleGooglePlayUIReady);
    };
  }, []);

  const handleSubscribe = async (paymentMethod: PaymentMethod) => {
    try {
      await paymentService.createSubscription('premium', paymentMethod);
      // Success toast will be shown after PayPal redirect or Google Play purchase
    } catch (error: any) {
      console.error('Subscription error:', error);
      
      // Handle already subscribed case
      if (error?.message === 'ALREADY_SUBSCRIBED') {
        toast.success('You are already subscribed to this plan');
        queryClient.invalidateQueries({ queryKey: ['subscription'] });
      } else {
        toast.error(error?.message || 'Failed to create subscription');
      }
    } finally {
      setIsSubscribing(false);
      setIsModalOpen(false); // Close modal for PayPal redirect
    }
  };

  const handleCancelSubscription = async () => {
    if (!confirm('Are you sure you want to cancel your subscription?')) return;
    if (!confirm('You will lose access to premium features at the end of your billing period. Are you absolutely sure?')) return;
    
    const currentSubscription = queryClient.getQueryData<Subscription>(['subscription', user?.id]);
    
    try {
      // Log subscription details for debugging
      console.log('[Cancel] Subscription details:', {
        hasGooglePlayToken: Boolean(subscription?.google_play_token),
        hasPayPalId: Boolean(subscription?.paypal_subscription_id),
        status: subscription?.status
      });
      
      // Optimistic update for subscription
      const optimisticSubscription: Subscription = {
        ...(currentSubscription as Subscription),
        status: 'canceled'
      };
      
      // Update React Query cache and Zustand store
      queryClient.setQueryData(['subscription', user?.id], optimisticSubscription);
      useStore.getState().setIsPremium(false);

      // Pass dummy payment method since it will be determined by tokens
      await paymentService.cancelSubscription('paypal');
      
      toast.success('Subscription cancelled successfully');
      
      // Refetch to get the actual state
      await queryClient.invalidateQueries({ queryKey: ['subscription'] });
    } catch (error: any) {
      console.error('[Cancel] Error details:', {
        message: error.message,
        name: error.name,
        stack: error.stack
      });

      // Roll back the subscription state
      queryClient.setQueryData(['subscription', user?.id], currentSubscription);
      useStore.getState().setIsPremium(isPremium);

      toast.error(error.message || 'Failed to cancel subscription');
    }
  };

  const handleResumeSubscription = () => {
    setIsModalOpen(true);
  };

  const handleNewSubscription = () => {
    setIsModalOpen(true);
  };

  return (
    <>
      <div className="bg-white rounded-xl shadow-soft p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">
          Subscription Plan
        </h2>
        <div className="grid md:grid-cols-2 gap-8">
          {SUBSCRIPTION_PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`relative bg-white rounded-xl p-6 transition-all ${
                selectedPlan === plan.id
                  ? 'border-2 border-primary-400 shadow-soft'
                  : 'border border-gray-200 hover:border-primary-200 shadow-sm hover:shadow-soft'
              }`}
            >
              {plan.id === 'premium' && (
                <span className="absolute -top-3 -right-3 bg-accent-500 text-white text-xs font-semibold px-3 py-1 rounded-full">
                  Recommended
                </span>
              )}
              <div className="flex flex-col h-full">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {plan.name.charAt(0).toUpperCase() + plan.name.slice(1)}
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">
                      {plan.id === 'free' ? 'Basic features' : 'All premium features'}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-bold text-gray-900">
                      ${plan.price}
                    </span>
                    <span className="text-gray-600">/mo</span>
                  </div>
                </div>
                <ul className="space-y-4 mb-8 flex-grow">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start">
                      <CheckIcon className="h-5 w-5 text-primary-500 mt-0.5 mr-3 flex-shrink-0" />
                      <span className="text-gray-600">{feature}</span>
                    </li>
                  ))}
                </ul>
                {plan.id === 'premium' && !isPremium && (
                  <button
                    onClick={handleNewSubscription}
                    disabled={isSubscribing}
                    className="w-full px-4 py-2.5 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Subscribe Now
                  </button>
                )}
                {plan.id === 'premium' && isPremium && (
                  <div className="space-y-4">
                    {subscription?.valid_until && (
                      <div className="text-gray-600 text-sm bg-gray-50 rounded-lg p-4">
                        Your premium access is valid until{' '}
                        <span className="font-medium text-gray-900">
                          {formatDateWithTimezone(subscription.valid_until, timezone)}
                        </span>
                        {subscription.status === 'canceled' && (
                          <span className="block mt-1 text-red-600">
                            Your subscription will not renew after this date
                          </span>
                        )}
                      </div>
                    )}
                    {subscription?.status === 'active' ? (
                      <button
                        onClick={handleCancelSubscription}
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium"
                      >
                        Cancel Subscription
                      </button>
                    ) : subscription?.status === 'canceled' && (
                      <button
                        onClick={handleResumeSubscription}
                        disabled={isSubscribing}
                        className="w-full px-4 py-2.5 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Resume Subscription
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <PaymentMethodModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSelect={(method) => handleSubscribe(method as PaymentMethod)}
        isProcessing={isSubscribing}
      />
    </>
  );
};