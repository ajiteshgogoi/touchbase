import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { contactsService } from '../services/contacts';
import dayjs from 'dayjs';
import type { Reminder, Contact, Interaction } from '../lib/supabase/types';
import { BellIcon, CalendarIcon } from '@heroicons/react/24/outline';
import { QuickInteraction } from '../components/contacts/QuickInteraction';

export const Reminders = () => {
  const { data: reminders } = useQuery({
    queryKey: ['reminders'],
    queryFn: () => contactsService.getReminders()
  });

  const { data: contacts } = useQuery<Contact[]>({
    queryKey: ['contacts'],
    queryFn: contactsService.getContacts
  });

  const [quickInteraction, setQuickInteraction] = useState<{
    isOpen: boolean;
    contactId: string;
    type: Interaction['type'];
  } | null>(null);

  const contactsMap = contacts?.reduce((acc, contact) => {
    acc[contact.id] = contact;
    return acc;
  }, {} as Record<string, Contact>) || {};

  const dueReminders = reminders?.filter((r: Reminder) => 
    !r.is_completed && dayjs(r.due_date).isBefore(dayjs())
  ) || [];

  const upcomingReminders = reminders?.filter((r: Reminder) => 
    !r.is_completed && dayjs(r.due_date).isAfter(dayjs())
  ) || [];

  const ReminderCard = ({ reminder }: { reminder: Reminder }) => {
    const contact = contactsMap[reminder.contact_id];

    return (
      <div className="bg-white rounded-lg shadow-soft p-4 hover:shadow-md transition-shadow">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="space-y-2.5">
              <div className="flex flex-wrap gap-4 text-sm">
                <span>
                  <span className="text-gray-700 font-medium">Contact:</span>{' '}
                  <span className="text-gray-900">{contact?.name || 'Unknown'}</span>
                </span>
              </div>
              <div className="flex flex-wrap gap-4 text-sm">
                <span>
                  <span className="text-gray-700 font-medium">Due:</span>{' '}
                  <span className="text-gray-600">{dayjs(reminder.due_date).format('MMM D, YYYY')}</span>
                </span>
              </div>
              {reminder.description && (
                <div className="flex flex-wrap gap-4 text-sm">
                  <span>
                    <span className="text-gray-700 font-medium">Suggestions:</span>{' '}
                    <span className="text-primary-500 whitespace-pre-line">
                      {reminder.description}
                    </span>
                  </span>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center sm:self-start">
            <button
              onClick={() => setQuickInteraction({ isOpen: true, contactId: reminder.contact_id, type: reminder.type })}
              className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-white bg-primary-500 hover:bg-primary-400 rounded-lg shadow-sm hover:shadow transition-all"
              title="Log an interaction"
            >
              Log Interaction
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reminders</h1>
          <p className="mt-1 text-sm text-gray-600">
            Track your upcoming and overdue reminders
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 bg-accent-50 rounded-lg">
                <BellIcon className="h-5 w-5 text-accent-500" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Due Reminders</h2>
            </div>
            <div className="space-y-4">
              {dueReminders.length === 0 ? (
                <p className="text-sm text-gray-600">No overdue reminders!</p>
              ) : (
                dueReminders.map((reminder) => (
                  <ReminderCard key={reminder.id} reminder={reminder} />
                ))
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 bg-primary-50 rounded-lg">
                <CalendarIcon className="h-5 w-5 text-primary-500" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Upcoming Reminders</h2>
            </div>
            <div className="space-y-4">
              {upcomingReminders.length === 0 ? (
                <p className="text-sm text-gray-600">No upcoming reminders!</p>
              ) : (
                upcomingReminders.map((reminder) => (
                  <ReminderCard key={reminder.id} reminder={reminder} />
                ))
              )}
            </div>
          </div>
        </div>
      </div>
      {quickInteraction && (
        <QuickInteraction
          isOpen={quickInteraction.isOpen}
          onClose={() => setQuickInteraction(null)}
          contactId={quickInteraction.contactId}
          defaultType={quickInteraction.type}
        />
      )}
    </>
  );
};

export default Reminders;