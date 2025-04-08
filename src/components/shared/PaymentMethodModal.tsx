import { Fragment, useLayoutEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { LoadingSpinner } from './LoadingSpinner';

interface PaymentMethod {
  id: 'paypal' | 'google_play';
  name: string;
  description: string;
  icon: string;
  disabled?: boolean;
  disabledReason?: string;
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
    icon: '🎮'
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
                    <div className="space-y-4">
                      {PAYMENT_METHODS.map((method) => (
                        <button
                          key={method.id}
                          onClick={() => !method.disabled && onSelect(method.id)}
                          disabled={method.disabled}
                          className={`w-full p-4 text-left border rounded-xl transition-all duration-200 flex items-start gap-4 ${
                            method.disabled
                              ? 'border-gray-200/75 dark:border-gray-700/75 bg-gray-50/90 dark:bg-gray-800/90 cursor-not-allowed opacity-60'
                              : 'border-gray-200/75 dark:border-gray-700/75 hover:border-primary-400 dark:hover:border-primary-500 hover:bg-primary-50/90 dark:hover:bg-primary-900/30 hover:shadow-sm dark:hover:shadow-soft-dark'
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