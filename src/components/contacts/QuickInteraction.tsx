import { Fragment, useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { supabase } from '../../lib/supabase/client';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { contactsService } from '../../services/contacts';
import type { Interaction } from '../../lib/supabase/types';
import dayjs from 'dayjs';

type InteractionType = Interaction['type'];

interface QuickInteractionProps {
  isOpen: boolean;
  onClose: () => void;
  contactId: string;
  defaultType?: InteractionType;
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
  defaultType = 'call',
  onSuccess
}: QuickInteractionProps) => {
  const [type, setType] = useState<InteractionType>(defaultType);
  const [selectedDate, setSelectedDate] = useState(() => getDateOptions()[0]?.value || dayjs());
  const [notes, setNotes] = useState('');
  const [sentiment, setSentiment] = useState<Interaction['sentiment']>('neutral');
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

  const handleSubmit = async () => {
    if (isSubmitting) return;
    
    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('You must be logged in to log interactions');

      try {
        // First add the interaction
        await contactsService.addInteraction({
          contact_id: contactId,
          user_id: user.id,
          type,
          date: selectedDate.toISOString(),
          notes: notes || null,
          sentiment
        });

        // If interaction is added successfully, update the contact's last_contacted date
        await contactsService.updateContact(contactId, {
          last_contacted: selectedDate.toISOString()
        });
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
      <Dialog onClose={onClose} className="relative z-50">
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/30" />
        </Transition.Child>

        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0 scale-95"
            enterTo="opacity-100 scale-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100 scale-100"
            leaveTo="opacity-0 scale-95"
          >
            <Dialog.Panel className="w-full max-w-md bg-white rounded-2xl shadow-xl">
              <div className="flex items-center justify-between p-6 border-b border-gray-100">
                <Dialog.Title className="text-lg font-medium">
                  Log Interaction
                </Dialog.Title>
                <button
                  onClick={onClose}
                  className="p-2 -m-2 text-gray-400 hover:text-gray-500"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Type
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {(['call', 'message', 'social', 'meeting', 'other'] as const).map((t) => (
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
                    Notes (optional)
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add any notes about the interaction..."
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-primary-400 focus:ring-primary-400"
                    rows={3}
                  />
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

              <div className="flex justify-end gap-3 px-6 py-4 bg-gray-50 rounded-b-2xl">
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
      </Dialog>
    </Transition>
  );
};