import { Fragment, useState, useEffect, useLayoutEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase/client';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { contactsService } from '../../services/contacts';
import type { Interaction } from '../../lib/supabase/types';
import { useStore } from '../../stores/useStore';
import dayjs from 'dayjs';

type InteractionType = Interaction['type'];

interface QuickInteractionProps {
  isOpen: boolean;
  onClose: () => void;
  contactId: string;
  contactName: string;
  defaultType?: InteractionType;
  defaultDate?: string;
  defaultNotes?: string | null;
  defaultSentiment?: Interaction['sentiment'];
  interactionId?: string;
  onSuccess?: () => void;
}

interface DateOption {
  label: string;
  value: dayjs.Dayjs;
}

const getDateOptions = (): DateOption[] => [
  { label: 'Just now', value: dayjs() },
  { label: 'Today', value: dayjs().startOf('day') },
  { label: 'Yesterday', value: dayjs().subtract(1, 'day') },
  { label: '2 days ago', value: dayjs().subtract(2, 'days') },
  { label: 'Last week', value: dayjs().subtract(1, 'week') },
  { label: '2 weeks ago', value: dayjs().subtract(2, 'weeks') },
  { label: 'Last month', value: dayjs().subtract(1, 'month') }
];

export const QuickInteraction = ({
  isOpen,
  onClose,
  contactId,
  contactName,
  defaultType = 'call',
  defaultDate,
  defaultNotes = '',
  defaultSentiment = 'neutral',
  interactionId,
  onSuccess
}: QuickInteractionProps) => {
  const { isPremium, isOnTrial } = useStore();
  const [type, setType] = useState<InteractionType>(defaultType);
  const [selectedDate, setSelectedDate] = useState(() => defaultDate ? dayjs(defaultDate) : (getDateOptions()[0]?.value || dayjs()));
  const [notes, setNotes] = useState(defaultNotes || '');
  const [sentiment, setSentiment] = useState<Interaction['sentiment']>(defaultSentiment);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // Check authentication when modal opens
    if (isOpen) {
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (!user) {
          alert('You must be logged in to log interactions');
          onClose();
        }
      });
    }
  }, [isOpen, onClose]);

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

  const handleSubmit = async () => {
    if (isSubmitting) return;
    
    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('You must be logged in to log interactions');

      try {
        const interactionData = {
          contact_id: contactId,
          user_id: user.id,
          type,
          date: selectedDate.toISOString(),
          notes: notes || null,
          sentiment
        };

        if (interactionId) {
          // Just update the interaction record for history
          await contactsService.updateInteraction(interactionId, interactionData);
        } else {
          // For new interactions:
          // 1. Record the interaction
          await contactsService.addInteraction(interactionData);
          // 2. Update contact with last_contacted which will handle reminders
          const contact = await contactsService.getContact(contactId);
          if (!contact) throw new Error('Contact not found');

          // Only update contact if this is the most recent interaction
          const { data: latestInteraction } = await supabase
            .from('interactions')
            .select('date')
            .eq('contact_id', contactId)
            .order('date', { ascending: false })
            .limit(1)
            .single();

          if (latestInteraction && new Date(latestInteraction.date) <= new Date(selectedDate.toISOString())) {
            await contactsService.updateContact(contactId, {
              last_contacted: selectedDate.toISOString(),
              missed_interactions: 0  // Reset missed interactions counter when logging a new interaction
            });
          }
        }
      } catch (error) {
        console.error('Database operation failed:', error);
        throw error; // Re-throw to be caught by outer catch block
      }

      onSuccess?.();
      onClose();
    } catch (error) {
      // Handle various error types
      if (error instanceof Error) {
        const supabaseError = error as { message?: string; details?: string; code?: string };
        console.error('Error details:', {
          message: supabaseError.message,
          details: supabaseError.details,
          code: supabaseError.code
        });
        
        if (supabaseError.code === '42501') {
          alert('Authentication error. Please try logging out and back in.');
        } else {
          alert(supabaseError.message || 'Failed to log interaction');
        }
      } else {
        console.error('Unknown error:', error);
        alert('An unexpected error occurred. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
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
              <Dialog.Panel className="w-full max-w-md bg-white rounded-2xl shadow-xl max-h-[90vh] flex flex-col">
                <div className="flex-shrink-0 flex items-center justify-between p-6 border-b border-gray-100">
                  <Dialog.Title className="text-lg font-medium">
                    Log Interaction for <span className="text-primary-500">{contactName}</span>
                  </Dialog.Title>
                  <button
                    onClick={onClose}
                    className="p-2 -m-2 text-gray-400 hover:text-gray-500"
                  >
                    <XMarkIcon className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Type
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {(['call', 'message', 'social', 'meeting'] as const).map((t) => (
                        <button
                          key={t}
                          onClick={() => setType(t)}
                          className={`px-4 py-2 text-sm font-medium rounded-lg capitalize ${
                            type === t
                              ? 'bg-primary-50 text-primary-700 border-2 border-primary-200'
                              : 'bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100'
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                      When?
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {getDateOptions().map(({ label, value }: DateOption) => (
                        <button
                          key={label}
                          onClick={() => setSelectedDate(value)}
                          type="button"
                          className={`px-4 py-2 text-sm font-medium rounded-lg ${
                            selectedDate.format('YYYY-MM-DD HH:mm') === value.format('YYYY-MM-DD HH:mm')
                              ? 'bg-primary-50 text-primary-700 border-2 border-primary-200'
                              : 'bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Notes
                    </label>
                    {(isPremium || isOnTrial) ? (
                      <div className="mb-4 p-4 bg-primary-50 rounded-lg">
                        <p className="text-sm text-gray-600">
                          Add details about this interaction to help our AI provide you with personalised suggestions.
                        </p>
                      </div>
                    ) : (
                      <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                        <p className="text-sm text-gray-600">
                          Add details about this interaction.
                          <span className="block mt-2">
                            ✨ <Link to="/settings" className="text-primary-600 hover:text-primary-500">Upgrade to Premium</Link> to get AI-powered suggestions based on your notes!
                          </span>
                        </p>
                      </div>
                    )}
                    <div>
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value.slice(0, 500))}
                        placeholder="Add any notes about the interaction..."
                        maxLength={500}
                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-primary-400 focus:ring-primary-400"
                        rows={3}
                      />
                      <div className="mt-2 flex justify-end">
                        <span className="text-sm text-gray-500">
                          {notes.length}/500 characters
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                      How did it go?
                    </label>
                    <div className="flex gap-2">
                      {(['positive', 'neutral', 'negative'] as const).map((s) => (
                        <button
                          key={s}
                          onClick={() => setSentiment(s)}
                          className={`px-4 py-2 text-sm font-medium rounded-lg capitalize ${
                            sentiment === s
                              ? 'bg-primary-50 text-primary-700 border-2 border-primary-200'
                              : 'bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100'
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex-shrink-0 flex justify-end gap-3 px-6 py-4 bg-gray-50 rounded-b-2xl">
                  <button
                    onClick={onClose}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="px-4 py-2 text-sm font-medium text-white bg-primary-500 rounded-lg hover:bg-primary-400 disabled:opacity-50"
                  >
                    {isSubmitting ? 'Saving...' : 'Save'}
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