import { useQuery } from '@tanstack/react-query';
import { contactsService } from '../services/contacts';
import dayjs from 'dayjs';
import type { Reminder } from '../lib/supabase/types';
import { BellIcon, CalendarIcon } from '@heroicons/react/24/outline';

export const Reminders = () => {
  const { data: reminders } = useQuery({
    queryKey: ['reminders'],
    queryFn: () => contactsService.getReminders()
  });

  const dueReminders = reminders?.filter((r: Reminder) => 
    !r.is_completed && dayjs(r.due_date).isBefore(dayjs())
  ) || [];

  const upcomingReminders = reminders?.filter((r: Reminder) => 
    !r.is_completed && dayjs(r.due_date).isAfter(dayjs())
  ) || [];

  const ReminderCard = ({ reminder }: { reminder: Reminder }) => (
    <div className="bg-white rounded-lg shadow-soft p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-medium text-gray-900">
            {reminder.type.charAt(0).toUpperCase() + reminder.type.slice(1)}
          </h3>
          <p className="mt-1 text-sm text-gray-600">{reminder.description}</p>
          <p className="mt-2 text-sm text-gray-500">
            Due: {dayjs(reminder.due_date).format('MMM D, YYYY')}
          </p>
        </div>
        <input
          type="checkbox"
          checked={reminder.is_completed}
          onChange={async () => {
            try {
              await contactsService.updateReminder(reminder.id, {
                ...reminder,
                is_completed: !reminder.is_completed
              });
            } catch (error) {
              console.error('Error updating reminder:', error);
            }
          }}
          className="h-4 w-4 text-primary-500 border-gray-300 rounded cursor-pointer"
        />
      </div>
    </div>
  );

  return (
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
  );
};

export default Reminders;