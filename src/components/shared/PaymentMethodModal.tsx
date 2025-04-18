import { Fragment, useEffect, useLayoutEffect, useState } from 'react';
import { Dialog, Transition, Disclosure } from '@headlessui/react';
import { XMarkIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
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
  onSelect: (methodOrPlan: PaymentMethod['id'] | SubscriptionProductId) => void;
  isProcessing: boolean;
}

const PAYMENT_METHODS: PaymentMethod[] = [
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
        description: 'Save 25% or $9/year with annual billing',
        price: annualPlan.price,
        highlight: true
      }
    ]
  },
  {
    id: 'paypal',
    name: 'PayPal',
    description: 'Pay using PayPal (credit/debit card or PayPal balance)',
    icon: '💳',
    options: [
      {
        id: 'premium', // Use internal plan ID for PayPal flow
        title: 'Monthly',
        description: 'Flexible month-to-month billing',
        price: monthlyPlan.price,
        monthlyEquivalent: monthlyPlan.monthlyEquivalent
      },
      {
        id: 'premium-annual', // Use internal plan ID for PayPal flow
        title: 'Annual',
        description: 'Save 25% or $9/year with annual billing',
        price: annualPlan.price,
        highlight: true
      }
    ]
  }
];

export const PaymentMethodModal = ({ isOpen, onClose, onSelect, isProcessing }: Props) => {
  const [openAccordion, setOpenAccordion] = useState<PaymentMethodId | null>(null);
  
  // Reset accordion state when modal opens
  useEffect(() => {
    if (isOpen) {
      setOpenAccordion(null);
    }
  }, [isOpen]);

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
                    <div className="space-y-4">
                      {PAYMENT_METHODS.map((method) => (
                        <Disclosure as="div" key={method.id} className="bg-white/60 dark:bg-gray-900/60 backdrop-blur-xl rounded-xl shadow-sm dark:shadow-soft-dark border border-gray-100/50 dark:border-gray-800/50 overflow-hidden">
                          <Disclosure.Button
                            onClick={() => setOpenAccordion(openAccordion === method.id ? null : method.id)}
                            disabled={method.disabled}
                            className={`w-full p-5 text-left flex items-start justify-between gap-4 transition-all duration-200 ${
                              method.disabled
                                ? 'bg-gray-50/90 dark:bg-gray-800/90 cursor-not-allowed opacity-60'
                                : `hover:bg-gray-50/80 dark:hover:bg-gray-800/80`
                            }`}
                          >
                            <div className="flex items-start gap-4">
                              <span className="text-2xl leading-none">{method.icon}</span>
                              <div>
                                <h4 className="font-[600] text-gray-900/90 dark:text-white">{method.name}</h4>
                                <p className="text-[15px] leading-relaxed text-gray-600/90 dark:text-gray-400 mt-1">
                                  {method.disabled ? method.disabledReason : method.description}
                                </p>
                              </div>
                            </div>
                            <ChevronDownIcon
                              className={`${openAccordion === method.id ? 'rotate-180' : ''} h-5 w-5 text-gray-400 dark:text-gray-500 transition-transform duration-200 flex-shrink-0`}
                              aria-hidden="true"
                            />
                          </Disclosure.Button>
                          
                          <Transition
                            show={openAccordion === method.id}
                            enter="transition duration-100 ease-out"
                            enterFrom="opacity-0"
                            enterTo="opacity-100"
                            leave="transition duration-75 ease-out"
                            leaveFrom="opacity-100"
                            leaveTo="opacity-0"
                          >
                            <Disclosure.Panel className="px-5 pb-5 pt-1 animate-fadeIn bg-white dark:bg-gray-900">
                              <div className="pt-3 border-t border-gray-200/75 dark:border-gray-700/75">
                                <h5 className="text-[15px] font-medium text-gray-700 dark:text-gray-300 mb-4">
                                  Select a plan:
                                </h5>
                                <div className="space-y-4">
                                  {method.options?.map((option) => (
                                    <button
                                      key={option.id}
                                      onClick={() => !method.disabled && option.id && onSelect(option.id)}
                                      disabled={method.disabled}
                                      className={`relative w-full p-4 text-left border rounded-xl transition-all duration-200 shadow-sm hover:shadow-md ${
                                        option.highlight
                                          ? 'bg-gray-50/60 dark:bg-gray-800/60 border-primary-200/50 dark:border-primary-700/50 hover:bg-primary-50/60 dark:hover:bg-primary-900/10 hover:border-primary-400/75 dark:hover:border-primary-400/50'
                                          : 'bg-gray-50/60 dark:bg-gray-800/60 border-gray-200/50 dark:border-gray-700/50 hover:border-primary-400/50 dark:hover:border-primary-500/50'
                                      } ${
                                        method.disabled ? 'cursor-not-allowed opacity-60' : ''
                                      }`}
                                    >
                                      {option.highlight && (
                                        <div className="absolute -top-3 right-4 bg-accent-500 text-white text-xs font-medium px-3 py-1 rounded-full shadow-sm">
                                          Best Value
                                        </div>
                                      )}
                                      <div className="flex justify-between items-start">
                                        <div>
                                          <h4 className="font-[600] text-gray-900 dark:text-white">{option.title}</h4>
                                          <p className="text-[15px] leading-relaxed text-gray-600/90 dark:text-gray-400 mt-1">
                                            {option.description}
                                          </p>
                                        </div>
                                        <div className="text-right">
                                          <div>
                                            <span className="font-[600] text-gray-900 dark:text-white">
                                              ${option.price}
                                            </span>
                                            <span className="text-sm text-gray-600/90 dark:text-gray-400">
                                              {option.title === 'Monthly' ? '/mo' : '/yr'}
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </Disclosure.Panel>
                          </Transition>
                        </Disclosure>
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