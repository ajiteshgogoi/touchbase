import { Fragment, useState, useLayoutEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { contactsService } from '../../services/contacts';
import { XMarkIcon, CalendarIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import dayjs from 'dayjs';
import { formatEventToUTC } from '../contacts/utils';
import type { Contact } from '../../lib/supabase/types';

interface QuickReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const QuickReminderModal = ({ isOpen, onClose }: QuickReminderModalProps) => {
  const [name, setName] = useState('');
  const [date, setDate] = useState(dayjs().add(1, 'day').format('YYYY-MM-DD'));
  const [isImportant, setIsImportant] = useState(false);

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

  const [selectedContact, setSelectedContact] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  
  const queryClient = useQueryClient();

  // Get contacts list
  const { data: contacts } = useQuery<Contact[]>({
    queryKey: ['contacts'],
    queryFn: contactsService.getContacts,
    staleTime: 5 * 60 * 1000
  });

  // Filter contacts based on search query
  const filteredContacts = contacts
    ?.filter(contact =>
      contact.name.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => a.name.localeCompare(b.name));

  const selectedContactName = contacts?.find(c => c.id === selectedContact)?.name;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!selectedContact) {
      setError('Please select a contact');
      return;
    }

    if (!name.trim()) {
      setError('Reminder name is required');
      return;
    }

    if (name.length > 150) {
      setError('Reminder description must be 150 characters or less');
      return;
    }

    if (!date) {
      setError('Date is required');
      return;
    }

    // Ensure date is in the future
    if (dayjs(date).isBefore(dayjs(), 'day')) {
      setError('Date must be in the future');
      return;
    }

    setIsSubmitting(true);

    try {
      // Check for existing reminders on the same day
      const reminders = await contactsService.getReminders(selectedContact);
      const selectedDate = dayjs(date).startOf('day');
      const existingReminder = reminders.find(reminder =>
        dayjs(reminder.due_date).startOf('day').isSame(selectedDate)
      );

      if (existingReminder) {
        setError('A reminder already exists for this contact on the selected date');
        setIsSubmitting(false);
        return;
      }

      await contactsService.addQuickReminder({
        contact_id: selectedContact,
        name: name.trim(),
        due_date: formatEventToUTC(date), // Convert to UTC with standardized time
        type: 'message', // Default to message type for quick reminders
        is_important: isImportant
      });
      
      // Invalidate reminders query to refresh the list
      queryClient.invalidateQueries({ queryKey: ['reminders'] });
      onClose();
    } catch (error) {
      console.error('Error adding quick reminder:', error);
      setError('Failed to add reminder. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Transition show={isOpen} as={Fragment}>
      <Dialog as="div" className="fixed inset-0 z-[100] overflow-hidden" onClose={onClose}>
        <div className="flex min-h-screen items-center justify-center px-4 pt-4 pb-20 text-center sm:p-0">
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

          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            enterTo="opacity-100 translate-y-0 sm:scale-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100 translate-y-0 sm:scale-100"
            leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
          >
            <div className="inline-block w-full max-w-md transform overflow-hidden rounded-2xl bg-white text-left shadow-xl transition-all">
              <div className="flex items-center justify-between p-6 border-b border-gray-100">
                <div>
                  <Dialog.Title as="h3" className="text-lg font-medium">
                    Add Quick Reminder
                  </Dialog.Title>
                  <p className="text-sm text-gray-500 mt-1">
                    1-time reminders for non-recurring events
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 -m-2 text-gray-400 hover:text-gray-500"
                  aria-label="Close"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit}>
                <div className="max-h-[calc(100vh-16rem)] overflow-y-auto p-6 space-y-4">
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Contact *
                    </label>
                    <div className="space-y-2">
                      <div className="relative">
                        <MagnifyingGlassIcon className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Search contacts..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="block w-full rounded-lg border-gray-200 pl-10 shadow-sm focus:border-primary-400 focus:ring-primary-400"
                        />
                      </div>
                      <div className="max-h-40 overflow-y-auto rounded-lg border border-gray-200">
                        {filteredContacts?.length === 0 ? (
                          <div className="p-3 text-sm text-gray-500">No contacts found</div>
                        ) : (
                          filteredContacts?.map((contact) => (
                            <button
                              key={contact.id}
                              type="button"
                              onClick={() => setSelectedContact(contact.id)}
                              className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 ${
                                selectedContact === contact.id ? 'bg-primary-50 text-primary-600' : 'text-gray-900'
                              }`}
                            >
                              {contact.name}
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                    <div className="mt-2 text-sm text-gray-600 h-5">
                      <span className={selectedContactName ? 'opacity-100' : 'opacity-0'}>
                        Selected: {selectedContactName || 'None'}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="reminder-name" className="block text-sm font-medium text-gray-700">
                      Reminder Description *
                    </label>
                    <div>
                      <textarea
                        id="reminder-name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        maxLength={150}
                        rows={3}
                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-primary-400 focus:ring-primary-400"
                        placeholder="Enter what the reminder is about..."
                        required
                      />
                      <div className="mt-2 flex justify-end">
                        <span className="text-sm text-gray-500">
                          {name.length}/150 characters
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="reminder-date" className="block text-sm font-medium text-gray-700">
                      Due Date *
                    </label>
                    <input
                      type="date"
                      id="reminder-date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      min={dayjs().add(1, 'day').format('YYYY-MM-DD')}
                      className="block w-full rounded-lg border-gray-200 shadow-sm focus:border-primary-400 focus:ring-primary-400"
                      required
                    />
                  </div>

                  <div className="mt-4 space-y-2">
                    <div className="space-y-1">
                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={isImportant}
                          onChange={(e) => setIsImportant(e.target.checked)}
                          className="rounded border-gray-300 text-primary-500 focus:ring-primary-400"
                        />
                        <span className="text-sm text-gray-700">This event is important</span>
                      </label>
                      <p className="text-xs text-gray-500 ml-6">
                        Checking this box will add the reminder to your important events timeline
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-6 bg-gray-50 border-t border-gray-100">
                  <div className="order-last sm:order-first text-sm text-red-600 min-h-[20px]">
                    {error}
                  </div>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="px-4 py-2 text-sm font-medium text-white bg-primary-500 rounded-lg hover:bg-primary-600 disabled:opacity-50"
                    >
                      <span className="min-w-[95px] inline-block text-center">
                        {isSubmitting ? 'Adding...' : 'Add Reminder'}
                      </span>
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition>
  );
};

export default QuickReminderModal;