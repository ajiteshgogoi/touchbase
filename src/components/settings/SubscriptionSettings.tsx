import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useStore } from '../../stores/useStore';
import { CheckIcon } from '@heroicons/react/24/outline';
import { formatDateWithTimezone } from '../../utils/date';
import { PaymentMethodModal } from '../shared/PaymentMethodModal';
import { CancellationModal } from '../shared/CancellationModal';
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

  const handleSubscribe = async (methodOrPlan: PaymentMethod | string) => {
    try {
      if (methodOrPlan === 'paypal') {
        await paymentService.createSubscription('premium', methodOrPlan);
      } else if (methodOrPlan.startsWith('touchbase_premium')) {
        await paymentService.createSubscription(methodOrPlan.includes('annual') ? 'premium-annual' : 'premium', 'google_play');
      }
    } catch (error: any) {
      console.error('Subscription error:', error);
      
      if (error?.message === 'ALREADY_SUBSCRIBED') {
        toast.success('You are already subscribed to this plan');
        queryClient.invalidateQueries({ queryKey: ['subscription'] });
      } else {
        toast.error(error?.message || 'Failed to create subscription');
      }
    } finally {
      setIsSubscribing(false);
      setIsModalOpen(false);
    }
  };
const [showCancellationModal, setShowCancellationModal] = useState(false);

const handleCancelSubscription = () => {
  setShowCancellationModal(true);
};

const processCancellation = async () => {
  const currentSubscription = queryClient.getQueryData<Subscription>(['subscription', user?.id]);
  
  try {
    console.log('[Cancel] Subscription details:', {
      hasGooglePlayToken: Boolean(subscription?.google_play_token),
      hasPayPalId: Boolean(subscription?.paypal_subscription_id),
      status: subscription?.status
    });
    
    const optimisticSubscription: Subscription = {
      ...(currentSubscription as Subscription),
      status: 'canceled'
    };
    
    queryClient.setQueryData(['subscription', user?.id], optimisticSubscription);
    useStore.getState().setIsPremium(false);

    await paymentService.cancelSubscription('paypal');
    
    await queryClient.invalidateQueries({ queryKey: ['subscription'] });
  } catch (error: any) {
    console.error('[Cancel] Error details:', {
      message: error.message,
      name: error.name,
      stack: error.stack
    });

    queryClient.setQueryData(['subscription', user?.id], currentSubscription);
    useStore.getState().setIsPremium(isPremium);

    throw error;
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
      <div className="bg-white/60 dark:bg-gray-900/60 backdrop-blur-xl rounded-xl border border-gray-100/50 dark:border-gray-800/50 shadow-soft dark:shadow-soft-dark hover:bg-white/70 dark:hover:bg-gray-900/70 transition-all duration-200 p-6">
        <h2 className="text-xl font-semibold text-primary-500 dark:text-primary-400 mb-6">
          Subscription Plan
        </h2>
        <div className="grid md:grid-cols-2 gap-8">
          {SUBSCRIPTION_PLANS.filter(plan => !plan.id.includes('annual')).map((plan) => (
            <div
              key={plan.id}
              className={`relative bg-white/60 dark:bg-gray-900/60 backdrop-blur-xl rounded-xl p-6 transition-all ${
                selectedPlan === plan.id
                  ? 'border-2 border-primary-400 dark:border-primary-500 shadow-soft dark:shadow-soft-dark'
                  : 'border border-gray-100/50 dark:border-gray-800/50 hover:border-primary-200 dark:hover:border-primary-700 shadow-soft dark:shadow-soft-dark'
              }`}
            >
              {plan.id === 'premium' && (
                <span className="absolute -top-3 -right-3 bg-accent-500 text-white text-[13px] font-[500] px-3 py-1 rounded-full shadow-soft">
                  Recommended
                </span>
              )}
              <div className="flex flex-col h-full">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                      {plan.name.charAt(0).toUpperCase() + plan.name.slice(1)}
                    </h3>
                    <p className="text-[15px] text-gray-600/90 dark:text-gray-400 mt-1">
                      {plan.id === 'free' ? 'Basic features' : 'All premium features'}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                      ${plan.price}
                    </span>
                    <span className="text-gray-600/90 dark:text-gray-400">/mo</span>
                  </div>
                </div>
                <ul className="space-y-4 mb-8 flex-grow">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start">
                      <CheckIcon className="h-5 w-5 text-primary-500 dark:text-primary-400 mt-0.5 mr-3 flex-shrink-0" />
                      <span className="text-gray-600/90 dark:text-gray-400">{feature}</span>
                    </li>
                  ))}
                </ul>
                {plan.id === 'premium' && !isPremium && (
                  <button
                    onClick={handleNewSubscription}
                    disabled={isSubscribing}
                    className="inline-flex items-center justify-center w-full px-5 py-3 rounded-xl text-[15px] font-[500] text-white bg-primary-500 dark:bg-primary-600 hover:bg-primary-600 dark:hover:bg-primary-700 shadow-soft dark:shadow-soft-dark active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Subscribe Now
                  </button>
                )}
                {plan.id === 'premium' && isPremium && (
                  <div className="space-y-4">
                    {subscription?.valid_until && (
                      <div className="text-[15px] text-gray-600/90 dark:text-gray-400 bg-gray-50/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-lg p-4">
                        Your premium access is valid until{' '}
                        <span className="font-medium text-gray-900 dark:text-gray-100">
                          {formatDateWithTimezone(subscription.valid_until, timezone)}
                        </span>
                        {subscription.status === 'canceled' && (
                          <span className="block mt-1 text-red-600 dark:text-red-500">
                            Your subscription will not renew after this date
                          </span>
                        )}
                      </div>
                    )}
                    {subscription?.status === 'active' ? (
                      <button
                        onClick={handleCancelSubscription}
                        className="inline-flex items-center justify-center w-full px-5 py-3 rounded-xl text-[15px] font-[500] text-gray-700 dark:text-gray-300 border border-gray-200/80 dark:border-gray-700/80 hover:bg-gray-50/80 dark:hover:bg-gray-800/80 shadow-soft dark:shadow-soft-dark active:scale-[0.98] transition-all duration-200"
                      >
                        Cancel Subscription
                      </button>
                    ) : subscription?.status === 'canceled' && (
                      <button
                        onClick={handleResumeSubscription}
                        disabled={isSubscribing}
                        className="inline-flex items-center justify-center w-full px-5 py-3 rounded-xl text-[15px] font-[500] text-white bg-primary-500 dark:bg-primary-600 hover:bg-primary-600 dark:hover:bg-primary-700 shadow-soft dark:shadow-soft-dark active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
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
        onSelect={(methodOrPlan) => handleSubscribe(methodOrPlan)}
        isProcessing={isSubscribing}
      />

      <CancellationModal
        isOpen={showCancellationModal}
        onClose={() => setShowCancellationModal(false)}
        onConfirmCancel={processCancellation}
        validUntil={subscription?.valid_until || ''}
        timezone={timezone}
      />
    </>
  );
};