import { Fragment, useLayoutEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { LoadingSpinner } from './LoadingSpinner';
import { SUBSCRIPTION_PLANS } from '../../services/payment/plans';

// Get the monthly and annual plans
const monthlyPlan = SUBSCRIPTION_PLANS.find(plan => plan.billingPeriod === 'monthly' && plan.id === 'premium');
const annualPlan = SUBSCRIPTION_PLANS.find(plan => plan.billingPeriod === 'annual' && plan.id === 'premium-annual');

if (!monthlyPlan || !annualPlan) {
  throw new Error('Required subscription plans not found');
}

type PaymentMethodId = 'paypal' | 'google_play';
type SubscriptionProductId = string;

interface PaymentMethod {
  id: PaymentMethodId;
  name: string;
  description: string;
  icon: string;
  disabled?: boolean;
  disabledReason?: string;
  options?: {
    id: SubscriptionProductId;
    title: string;
    description: string;
    price: number;
    monthlyEquivalent?: number;
    savings?: string;
    highlight?: boolean;
  }[];
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (method: PaymentMethod['id']) => void;
  isProcessing: boolean;
}

const PAYMENT_METHODS: PaymentMethod[] = [
  {
    id: 'paypal',
    name: 'PayPal',
    description: 'Pay securely using PayPal',
    icon: '💳'
  },
  {
    id: 'google_play',
    name: 'Google Play',
    description: 'Pay through Google Play (only available if installed from Play Store)',
    icon: '🎮',
    options: [
      {
        id: monthlyPlan.googlePlayProductId!,
        title: 'Monthly',
        description: 'Flexible month-to-month billing',
        price: monthlyPlan.price,
        monthlyEquivalent: monthlyPlan.monthlyEquivalent
      },
      {
        id: annualPlan.googlePlayProductId!,
        title: 'Annual',
        description: 'Save 25% with annual billing',
        price: annualPlan.price,
        monthlyEquivalent: annualPlan.monthlyEquivalent,
        savings: 'Save $9/year',
        highlight: true
      }
    ]
  }
];

export const PaymentMethodModal = ({ isOpen, onClose, onSelect, isProcessing }: Props) => {
  useLayoutEffect(() => {
    if (isOpen) {
      // Calculate scrollbar width
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
      document.documentElement.style.setProperty('--scrollbar-width', `${scrollbarWidth}px`);
      
      // Add modal-open class to body
      document.body.classList.add('modal-open');
    } else {
      // Remove modal-open class and reset scrollbar width
      document.body.classList.remove('modal-open');
      document.documentElement.style.setProperty('--scrollbar-width', '0px');
    }

    return () => {
      // Cleanup
      document.body.classList.remove('modal-open');
      document.documentElement.style.setProperty('--scrollbar-width', '0px');
    };
  }, [isOpen]);

  return (
    <Transition show={isOpen} as={Fragment}>
      <Dialog as="div" className="fixed inset-0 z-[100]" onClose={onClose}>
        <div className="min-h-full">
          {/* Backdrop */}
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
          </Transition.Child>

          <div className="fixed inset-0 flex items-center justify-center p-4 z-10">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-xl dark:shadow-soft-dark max-h-[90vh] flex flex-col overflow-hidden">
                <div className="flex-shrink-0 flex items-center justify-between p-6 border-b border-gray-100/75 dark:border-gray-800/75">
                  <Dialog.Title as="h3" className="text-lg font-medium text-gray-900 dark:text-white">
                    Select Payment Method
                  </Dialog.Title>
                  <button
                    onClick={onClose}
                    className="p-2 -m-2 text-gray-400 hover:text-gray-500 dark:text-gray-500 dark:hover:text-gray-400 transition-colors"
                    disabled={isProcessing}
                    aria-label="Close"
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                  {isProcessing ? (
                    <div className="flex flex-col items-center justify-center h-40">
                      <LoadingSpinner />
                      <p className="mt-4 text-primary-500 dark:text-primary-400">Processing payment...</p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {PAYMENT_METHODS.map((method) => (
                        <div key={method.id} className="space-y-3">
                          {!method.options ? (
                            // Regular payment method button (PayPal)
                            <button
                              onClick={() => !method.disabled && onSelect(method.id)}
                              disabled={method.disabled}
                              className={`w-full p-4 text-left border rounded-xl transition-all duration-200 flex items-start gap-4 bg-white dark:bg-gray-800 ${
                                method.disabled
                                  ? 'border-gray-200/75 dark:border-gray-700/75 cursor-not-allowed opacity-60'
                                  : 'border-gray-200/75 dark:border-gray-700/75 hover:border-primary-400 dark:hover:border-primary-500 hover:shadow-sm dark:hover:shadow-soft-dark'
                              }`}
                            >
                              <span className="text-2xl">{method.icon}</span>
                              <div>
                                <h4 className="font-medium text-gray-900 dark:text-white">{method.name}</h4>
                                <p className="text-sm text-gray-600/90 dark:text-gray-400 mt-1">
                                  {method.disabled ? method.disabledReason : method.description}
                                </p>
                              </div>
                            </button>
                          ) : (
                            // Payment method with options (Google Play)
                            <div className="border rounded-xl p-4 bg-gray-50/50 dark:bg-gray-900/90">
                              <div className="flex items-center gap-3 mb-4">
                                <span className="text-2xl">{method.icon}</span>
                                <div>
                                  <h4 className="font-medium text-gray-900 dark:text-white">{method.name}</h4>
                                  <p className="text-sm text-gray-600/90 dark:text-gray-400">
                                    {method.description}
                                  </p>
                                </div>
                              </div>
                              <div className="grid gap-3 mt-2">
                                <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 px-1">
                                  Select a plan:
                                </h5>
                                {method.options.map((option) => (
                                  <button
                                    key={option.id}
                                    onClick={() => !method.disabled && option.id && onSelect(method.id)}
                                    disabled={method.disabled}
                                    className={`relative w-full p-4 text-left border rounded-xl transition-all duration-200 bg-white dark:bg-gray-800 ${
                                      option.highlight
                                        ? 'border-primary-500 dark:border-primary-400'
                                        : 'border-gray-200/75 dark:border-gray-700/75 hover:border-primary-400 dark:hover:border-primary-500'
                                    } hover:shadow-sm dark:hover:shadow-soft-dark ${
                                      method.disabled ? 'cursor-not-allowed opacity-60' : ''
                                    }`}
                                  >
                                    {option.highlight && (
                                      <div className="absolute -top-3 -right-3 bg-accent-500 text-white text-[13px] font-[500] px-3 py-1 rounded-full shadow-soft">
                                        Best Value
                                      </div>
                                    )}
                                    <div className="flex justify-between items-start">
                                      <div>
                                        <h4 className="font-medium text-gray-900 dark:text-white">{option.title}</h4>
                                        <p className="text-sm text-gray-600/90 dark:text-gray-400 mt-1">
                                          {option.description}
                                        </p>
                                      </div>
                                      <div className="text-right">
                                        <div className="font-medium text-gray-900 dark:text-white">
                                          ${option.price}
                                        </div>
                                        {option.monthlyEquivalent && (
                                          <div className="text-sm text-gray-600/90 dark:text-gray-400">
                                            ${option.monthlyEquivalent}/mo
                                          </div>
                                        )}
                                        {option.savings && (
                                          <div className="text-sm font-medium text-primary-600 dark:text-primary-400 mt-1">
                                            {option.savings}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};