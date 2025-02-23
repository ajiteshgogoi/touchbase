import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { contactsService } from '../../services/contacts';
import { Dialog } from '@headlessui/react';
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
      await contactsService.addQuickReminder({
        contact_id: selectedContact,
        name: name.trim(),
        due_date: formatEventToUTC(date), // Convert to UTC with standardized time
        type: 'message', // Default to message type for quick reminders
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
    <Dialog open={isOpen} onClose={onClose} className="fixed inset-0 z-[100]">
      <div className="min-h-full">
        <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4 z-10">
          <Dialog.Panel className="w-full max-w-md bg-white rounded-2xl shadow-xl max-h-[90vh] flex flex-col">
            <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <Dialog.Title className="text-lg font-medium">Add Quick Reminder</Dialog.Title>
              <button
                onClick={onClose}
                className="p-2 -m-2 text-gray-400 hover:text-gray-500"
                aria-label="Close"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col flex-1">
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Contact *
                  </label>
                  <div className="space-y-2">
                    <div className="relative">
                      <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
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
                  <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600">
                      Add details about what you want to be reminded of.
                    </p>
                  </div>
                  <div>
                    <textarea
                      id="reminder-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      maxLength={150}
                      rows={3}
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-primary-400 focus:ring-primary-400 resize-none"
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

                {error && (
                  <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">
                    {error}
                  </div>
                )}
              </div>

              <div className="flex-shrink-0 flex flex-col-reverse sm:flex-row justify-end gap-3 px-6 py-4 bg-gray-50 rounded-b-2xl">
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
                  className="px-4 py-2 text-sm font-medium text-white bg-primary-500 rounded-lg hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <CalendarIcon className="animate-spin -ml-1 mr-2 h-4 w-4" />
                      Adding...
                    </>
                  ) : (
                    'Add Reminder'
                  )}
                </button>
              </div>
            </form>
          </Dialog.Panel>
        </div>
      </div>
    </Dialog>
  );
};

export default QuickReminderModal;