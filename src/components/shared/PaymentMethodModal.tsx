import { Fragment } from 'react';
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
  const handleClose = () => {
    if (!isProcessing) {
      // Only allow closing if not processing
      onClose();
    }
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog
        as="div"
        className="relative z-50"
        onClose={handleClose}
        static // Prevent closing while processing
      >
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-25" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                <Dialog.Title as="div" className="flex justify-between items-start mb-6">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Select Payment Method
                  </h3>
                  <button
                    onClick={onClose}
                    className="text-gray-400 hover:text-gray-500"
                    disabled={isProcessing}
                    aria-label="Close"
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </Dialog.Title>

                {isProcessing ? (
                  <div className="flex flex-col items-center justify-center h-40">
                    <LoadingSpinner />
                    <p className="mt-4 text-primary-500">Processing payment...</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {PAYMENT_METHODS.map((method) => (
                      <button
                        key={method.id}
                        onClick={() => {
                          if (!method.disabled && !isProcessing) {
                            // Check payment method availability
                            if (method.id === 'google_play' && typeof PaymentRequest === 'undefined') {
                              method.disabled = true;
                              method.disabledReason = 'Google Play Billing is not available. Please ensure you installed from Play Store.';
                              return;
                            }
                            // Prevent double-clicks
                            if (!isProcessing) {
                              onSelect(method.id);
                            }
                          }
                        }}
                        disabled={method.disabled || isProcessing}
                        className={`w-full p-4 text-left border rounded-lg transition-colors flex items-start gap-4 ${
                          method.disabled || isProcessing
                            ? 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-60'
                            : 'hover:border-primary-500 hover:bg-primary-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2'
                        }`}
                        aria-disabled={method.disabled || isProcessing}
                      >
                        <span className="text-2xl">{method.icon}</span>
                        <div>
                          <h4 className="font-medium text-gray-900">{method.name}</h4>
                          <p className="text-sm text-gray-600 mt-1">
                            {method.disabled ? method.disabledReason : method.description}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};