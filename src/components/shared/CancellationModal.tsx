import { Fragment, useState, useLayoutEffect } from 'react';
import { Dialog, Transition, RadioGroup } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { supabase } from '../../lib/supabase/client';
import { useStore } from '../../stores/useStore';

const CANCELLATION_REASONS = [
  { id: 'too_expensive', label: 'Too expensive' },
  { id: 'missing_features', label: 'Missing features I need' },
  { id: 'not_using', label: 'Not using it enough' },
  { id: 'found_alternative', label: 'Found a better alternative' },
  { id: 'temporary', label: 'Temporary break; might return later' },
  { id: 'other', label: 'Other reason' }
];

interface CancellationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmCancel: () => Promise<void>;
  validUntil: string;
  timezone: string;
}

export const CancellationModal = ({ 
  isOpen, 
  onClose, 
  onConfirmCancel,
  validUntil,
  timezone
}: CancellationModalProps) => {
  const { user } = useStore();
  const [selectedReason, setSelectedReason] = useState('');
  const [additionalFeedback, setAdditionalFeedback] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const maxLength = 500;

  useLayoutEffect(() => {
    if (isOpen) {
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
      document.documentElement.style.setProperty('--scrollbar-width', `${scrollbarWidth}px`);
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
      document.documentElement.style.setProperty('--scrollbar-width', '0px');
    }

    return () => {
      document.body.classList.remove('modal-open');
      document.documentElement.style.setProperty('--scrollbar-width', '0px');
    };
  }, [isOpen]);

  const handleSubmit = async () => {
    if (!user || !selectedReason || isSubmitting) return;

    setIsSubmitting(true);
    try {
      // Store cancellation feedback
      const { error: feedbackError } = await supabase
        .from('feedback')
        .insert({
          user_id: user.id,
          email: user.email,
          feedback: additionalFeedback.trim(),
          type: 'cancellation',
          reason: selectedReason
        });

      if (feedbackError) throw feedbackError;

      // Process the actual cancellation
      await onConfirmCancel();
      
      onClose();
    } catch (error) {
      console.error('Failed to process cancellation:', error);
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: timezone
    });
  };

  return (
    <Transition show={isOpen} as={Fragment}>
      <Dialog onClose={onClose} className="fixed inset-0 z-[100]">
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

          {/* Modal content */}
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
                  <div>
                    <Dialog.Title className="text-lg font-medium text-gray-900 dark:text-white">
                      Cancel Subscription
                    </Dialog.Title>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      We're sorry to see you go. Please help us improve by sharing your feedback.
                    </p>
                  </div>
                  <button
                    onClick={onClose}
                    className="p-2 -m-2 text-gray-400 hover:text-gray-500 dark:text-gray-500 dark:hover:text-gray-400"
                    disabled={isSubmitting}
                    aria-label="Close"
                  >
                    <XMarkIcon className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                  <div className="space-y-6">
                    {/* Info box */}
                    <div className="p-4 bg-gray-50/80 dark:bg-gray-800/80 rounded-xl border border-gray-100/75 dark:border-gray-700/75 text-sm text-gray-600 dark:text-gray-400">
                      Your premium access will continue until <span className="font-medium text-gray-900 dark:text-white">{formatDate(validUntil)}</span>.
                      After this date, you'll lose access to premium features.
                    </div>

                    {/* Reason selection */}
                    <div className="space-y-4">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Why are you cancelling?
                      </label>
                      <RadioGroup value={selectedReason} onChange={setSelectedReason}>
                        <div className="space-y-3">
                          {CANCELLATION_REASONS.map((reason) => (
                            <RadioGroup.Option
                              key={reason.id}
                              value={reason.id}
                              className={({ checked }) =>
                                `relative rounded-lg px-4 py-3 cursor-pointer flex focus:outline-none
                                ${checked
                                  ? 'bg-primary-50/90 dark:bg-primary-900/30 border border-primary-200 dark:border-primary-800'
                                  : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50/80 dark:hover:bg-gray-700/80'
                                }`
                              }
                            >
                              {({ checked }) => (
                                <>
                                  <div className="flex w-full items-center justify-between">
                                    <RadioGroup.Label className="text-sm text-gray-900 dark:text-white">
                                      {reason.label}
                                    </RadioGroup.Label>
                                    {checked && (
                                      <div className="bg-primary-500 dark:bg-primary-400 rounded-full w-2 h-2" />
                                    )}
                                  </div>
                                </>
                              )}
                            </RadioGroup.Option>
                          ))}
                        </div>
                      </RadioGroup>
                    </div>

                    {/* Additional feedback */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        {selectedReason === 'other' ? 'Please specify your reason' : 'Additional feedback (optional)'}
                      </label>
                      <textarea
                        value={additionalFeedback}
                        onChange={(e) => setAdditionalFeedback(e.target.value.slice(0, maxLength))}
                        placeholder={
                          selectedReason === 'other'
                            ? "Please tell us why you're cancelling..."
                            : "Help us understand how we can improve..."
                        }
                        className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-xl focus:outline-none focus:border-primary-400 dark:focus:border-primary-500 focus:ring-1 focus:ring-primary-400 dark:focus:ring-primary-500 transition-colors duration-200 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                        rows={4}
                      />
                      <div className="mt-2 flex justify-end">
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {additionalFeedback.length}/{maxLength} characters
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex-shrink-0 flex justify-end gap-3 px-6 py-4 bg-gray-50/80 dark:bg-gray-800/80 rounded-b-2xl border-t border-gray-100/75 dark:border-gray-800/75">
                  <button
                   onClick={handleSubmit}
                   disabled={!selectedReason || isSubmitting || (selectedReason === 'other' && !additionalFeedback.trim())}
                   className="px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white/80 dark:bg-gray-900/80 ring-1 ring-gray-200/75 dark:ring-gray-700/75 rounded-xl hover:bg-gray-50/90 dark:hover:bg-gray-800/90 disabled:opacity-50 transition-all duration-200 shadow-sm dark:shadow-soft-dark"
                 >
                   {isSubmitting ? 'Processing...' : 'Confirm Cancellation'}
                 </button>
                 <button
                   onClick={onClose}
                   disabled={isSubmitting}
                   className="px-4 py-2.5 text-sm font-medium text-white bg-primary-500 dark:bg-primary-600 hover:bg-primary-600 dark:hover:bg-primary-700 rounded-xl transition-all duration-200 shadow-sm dark:shadow-soft-dark"
                 >
                   Keep Subscription
                 </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};