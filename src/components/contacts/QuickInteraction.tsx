import { Fragment, useState, useEffect, useLayoutEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase/client';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { contactsService } from '../../services/contacts';
import { toast } from 'react-hot-toast';
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

const QuickInteraction = ({
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
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      alert('You must be logged in to log interactions');
      setIsSubmitting(false);
      return;
    }

    const interactionData = {
      contact_id: contactId,
      user_id: user.id,
      type,
      date: selectedDate.toISOString(),
      notes: notes || null,
      sentiment
    };

    // Close modal immediately for better UX
    onSuccess?.();
    onClose();

    try {
      // Optimistically update the cache with the new interaction
      const queryClient = await import('../../utils/queryClient').then(m => m.getQueryClient());
      
      if (interactionId) {
        // For updating existing interaction
        const oldInteractions = queryClient.getQueryData(['interactions', contactId]) as Interaction[] | undefined;
        const oldInteraction = oldInteractions?.find(i => i.id === interactionId);

        try {
          // Update interactions cache
          queryClient.setQueryData(['interactions', contactId], (old: any) => {
            if (!Array.isArray(old)) return old;
            return old.map(interaction =>
              interaction.id === interactionId ? { ...interaction, ...interactionData } : interaction
            );
          });

          // Helper functions for cache updates
          const updateContactCache = (oldContacts: any) => {
            if (!Array.isArray(oldContacts)) return oldContacts;
            return oldContacts.map(contact => {
              if (contact.id !== contactId) return contact;
              // Only update last_contacted if this was the most recent interaction
              // and the date has changed
              if (oldInteraction &&
                  oldInteraction.date === contact.last_contacted &&
                  selectedDate.toISOString() !== oldInteraction.date) {
                return {
                  ...contact,
                  last_contacted: selectedDate.toISOString(),
                  next_contact_due: selectedDate.toISOString()
                };
              }
              return contact;
            });
          };

          // Update all relevant caches optimistically
          queryClient.setQueryData(['contacts'], updateContactCache);
          queryClient.setQueryData(['recent-contacts'], updateContactCache);
          queryClient.setQueryData(['contact-with-events', contactId], (old: any) => {
            if (!old?.contact) return old;
            // Only update if this was the most recent interaction
            if (oldInteraction &&
                oldInteraction.date === old.contact.last_contacted &&
                selectedDate.toISOString() !== oldInteraction.date) {
              return {
                ...old,
                contact: {
                  ...old.contact,
                  last_contacted: selectedDate.toISOString(),
                  next_contact_due: selectedDate.toISOString()
                }
              };
            }
            return old;
          });

          // Perform the actual update
          await contactsService.updateInteraction(interactionId, interactionData);
          toast.success('Interaction updated successfully');

        } catch (error) {
          // Revert optimistic updates on error
          queryClient.invalidateQueries({ queryKey: ['interactions', contactId] });
          queryClient.invalidateQueries({ queryKey: ['contacts'] });
          queryClient.invalidateQueries({ queryKey: ['recent-contacts'] });
          queryClient.invalidateQueries({ queryKey: ['contact-with-events', contactId] });
          toast.error('Failed to update interaction. Please try again.');
          console.error('Error updating interaction:', error);
          throw error; // Re-throw to be caught by outer catch
        }
      } else {
        // For new interaction
        const tempId = `temp-${Date.now()}`;
        const optimisticInteraction = {
          id: tempId,
          ...interactionData,
          created_at: new Date().toISOString()
        };

        try {
          // Update all necessary caches optimistically
          // 1. Update interactions cache
          queryClient.setQueryData(['interactions', contactId], (old: any) => {
            if (!Array.isArray(old)) return [optimisticInteraction];
            return [optimisticInteraction, ...old];
          });

          // Helper function to update contact in cache
          const updateContactCache = (oldContacts: any) => {
            if (!Array.isArray(oldContacts)) return oldContacts;
            return oldContacts.map(contact =>
              contact.id === contactId
                ? {
                    ...contact,
                    last_contacted: selectedDate.toISOString(),
                    next_contact_due: selectedDate.toISOString(),
                    missed_interactions: 0
                  }
                : contact
            );
          };

          // Helper function to update reminders cache
          const updateRemindersCache = (oldReminders: any) => {
            if (!Array.isArray(oldReminders)) return oldReminders;
            return oldReminders.filter(reminder =>
              reminder.contact_id !== contactId || reminder.name !== null
            );
          };

          // Update all caches
          queryClient.setQueryData(['contacts'], updateContactCache);
          queryClient.setQueryData(['recent-contacts'], updateContactCache);
          queryClient.setQueryData(['contact-with-events', contactId], (old: any) => {
            if (!old?.contact) return old;
            return {
              ...old,
              contact: {
                ...old.contact,
                last_contacted: selectedDate.toISOString(),
                next_contact_due: selectedDate.toISOString(),
                missed_interactions: 0
              }
            };
          });
          queryClient.setQueryData(['reminders'], updateRemindersCache);

          // Add the interaction
          await contactsService.addInteraction(interactionData);
          toast.success('Interaction logged successfully');
          
          // Get contact to update last_contacted
          const contact = await contactsService.getContact(contactId);
          if (!contact) throw new Error('Contact not found');

          // Check if this is the most recent interaction
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
              missed_interactions: 0,
              contact_frequency: contact.contact_frequency
            });
          }

        } catch (error) {
          // Revert optimistic updates on error
          queryClient.invalidateQueries({ queryKey: ['interactions', contactId] });
          queryClient.invalidateQueries({ queryKey: ['contacts'] });
          queryClient.invalidateQueries({ queryKey: ['recent-contacts'] });
          queryClient.invalidateQueries({ queryKey: ['contact-with-events', contactId] });
          queryClient.invalidateQueries({ queryKey: ['reminders'] });
          queryClient.invalidateQueries({ queryKey: ['total-reminders'] });
          toast.error('Failed to save interaction. Please try again.');
          console.error('Error saving interaction:', error);
          throw error; // Re-throw to be caught by outer catch
        }
      }
    } catch (error) {
      if (error instanceof Error) {
        const supabaseError = error as { message?: string; details?: string; code?: string };
        console.error('Error details:', {
          message: supabaseError.message,
          details: supabaseError.details,
          code: supabaseError.code
        });
        
        if (supabaseError.code === '42501') {
          toast.error('Authentication error. Please try logging out and back in.');
        } else {
          toast.error(supabaseError.message || 'Failed to log interaction');
        }
      } else {
        console.error('Unknown error:', error);
        toast.error('An unexpected error occurred. Please try again.');
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
              <Dialog.Panel className="w-full max-w-md bg-white rounded-2xl shadow-xl max-h-[90vh] flex flex-col overflow-hidden">
                <div className="flex-shrink-0 flex items-center justify-between p-6 border-b border-gray-100/75">
                  <Dialog.Title className="text-lg font-medium">
                    Log Interaction for <span className="text-primary-500">{contactName}</span>
                  </Dialog.Title>
                  <button
                    onClick={onClose}
                    className="p-2 -m-2 text-gray-400 hover:text-gray-500"
                    aria-label="Close"
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
                          className={`px-4 py-2 text-sm font-medium rounded-xl capitalize transition-all duration-200 ${
                            type === t
                              ? 'bg-primary-50/90 text-primary-700 ring-1 ring-primary-200 shadow-sm'
                              : 'bg-gray-50/90 text-gray-700 hover:bg-gray-100/90 ring-1 ring-gray-200/75'
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
                          className={`px-4 py-2 text-sm font-medium rounded-xl transition-all duration-200 ${
                            selectedDate.format('YYYY-MM-DD HH:mm') === value.format('YYYY-MM-DD HH:mm')
                              ? 'bg-primary-50/90 text-primary-700 ring-1 ring-primary-200 shadow-sm'
                              : 'bg-gray-50/90 text-gray-700 hover:bg-gray-100/90 ring-1 ring-gray-200/75'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
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
                         className={`px-4 py-2 text-sm font-medium rounded-xl capitalize transition-all duration-200 ${
                           sentiment === s
                             ? 'bg-primary-50/90 text-primary-700 ring-1 ring-primary-200 shadow-sm'
                             : 'bg-gray-50/90 text-gray-700 hover:bg-gray-100/90 ring-1 ring-gray-200/75'
                         }`}
                       >
                         {s}
                       </button>
                     ))}
                   </div>
                 </div>

                 <div className="space-y-2">
                   <label className="block text-sm font-medium text-gray-700">
                     Notes (optional)
                   </label>
                   {(isPremium || isOnTrial) ? (
                     <div className="mb-4 px-4 py-3 bg-primary-50/50 rounded-xl ring-1 ring-primary-100/50">
                       <p className="text-sm text-gray-600/90">
                         Add details about this interaction that can help maintain the relationship.
                       </p>
                     </div>
                   ) : (
                     <div className="mb-4 px-4 py-3 bg-gray-50/80 rounded-xl ring-1 ring-gray-100/50">
                       <p className="text-sm text-gray-600">
                         Add details about this interaction.
                         <span className="block mt-2">
                           ✨ <Link to="/settings" className="text-primary-600 hover:text-primary-500">Upgrade to Premium</Link> to get personalised suggestions based on your notes!
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
                       className="w-full px-4 py-3 rounded-xl bg-white border border-gray-200 focus:outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-400 transition-colors duration-200"
                       rows={3}
                     />
                     <div className="mt-2 flex justify-end">
                       <span className="text-sm text-gray-500">
                         {notes.length}/500 characters
                       </span>
                     </div>
                   </div>
                 </div>
                </div>

                <div className="flex-shrink-0 flex justify-end gap-3 px-6 py-4 bg-gray-50/80 rounded-b-2xl border-t border-gray-100/75">
                   <button
                     onClick={onClose}
                     className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-white/80 ring-1 ring-gray-200/75 rounded-xl hover:bg-gray-50/90 transition-all duration-200 shadow-sm"
                   >
                     Cancel
                   </button>
                   <button
                     onClick={handleSubmit}
                     disabled={isSubmitting}
                     className="px-4 py-2.5 text-sm font-medium text-white bg-primary-500 rounded-xl hover:bg-primary-600 disabled:opacity-50 transition-all duration-200 shadow-sm"
                  >
                    <span className="min-w-[52px] inline-block text-center">
                      {isSubmitting ? 'Saving...' : 'Save'}
                    </span>
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

export default QuickInteraction;