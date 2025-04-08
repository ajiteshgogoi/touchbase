import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { contactsService } from '../../services/contacts';
import { UserGroupIcon, CalendarIcon } from '@heroicons/react/24/outline/esm/index.js';
import { useStore } from '../../stores/useStore';
import dayjs from 'dayjs';
import type { Reminder } from '../../lib/supabase/types';

export const DashboardMetrics = () => {
  const { isPremium, isOnTrial } = useStore();
  const { data: totalContacts = 0 } = useQuery({
    queryKey: ['total-contacts'],
    queryFn: contactsService.getTotalContactCount,
    staleTime: 5 * 60 * 1000 // Cache for 5 minutes
  });

  const { data: reminders } = useQuery({
    queryKey: ['reminders'],
    queryFn: () => contactsService.getReminders(),
    staleTime: 5 * 60 * 1000
  });

  const today = dayjs();
  const metrics = {
    totalContacts: isPremium || isOnTrial ? totalContacts : Math.min(totalContacts, 15),
    dueToday: reminders?.filter((r: Reminder) => {
      const dueDate = dayjs(r.due_date);
      return dueDate.isSame(today, 'day');
    }).length || 0,
    upcomingReminders: reminders?.filter((r: Reminder) => {
      const dueDate = dayjs(r.due_date);
      return dueDate.isAfter(today) && !dueDate.isSame(today, 'day');
    }).length || 0,
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      <Link to="/contacts" className="flex">
        <div className="bg-white/60 dark:bg-gray-900/60 backdrop-blur-xl rounded-xl border border-gray-100/50 dark:border-gray-800/50 shadow-soft dark:shadow-soft-dark hover:bg-white/70 dark:hover:bg-gray-900/70 hover:shadow-md transition-all duration-200 p-6 cursor-pointer flex-1 flex items-center justify-center">
          <div className="flex items-center w-full">
            <div className="p-3 bg-primary-50 dark:bg-primary-900/30 rounded-lg">
              <UserGroupIcon className="h-8 w-8 text-primary-500 dark:text-primary-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">All Contacts</p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">{metrics.totalContacts}</p>
            </div>
          </div>
        </div>
      </Link>

      <Link to="/reminders" className="flex">
        <div className="bg-white/60 dark:bg-gray-900/60 backdrop-blur-xl rounded-xl border border-gray-100/50 dark:border-gray-800/50 shadow-soft dark:shadow-soft-dark hover:bg-white/70 dark:hover:bg-gray-900/70 hover:shadow-md transition-all duration-200 p-6 cursor-pointer flex-1 flex items-center justify-center">
          <div className="flex items-center w-full">
            <div className="p-3 bg-yellow-50 dark:bg-yellow-900/30 rounded-lg">
              <CalendarIcon className="h-8 w-8 text-yellow-500 dark:text-yellow-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Interactions Due Today</p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">{metrics.dueToday}</p>
            </div>
          </div>
        </div>
      </Link>

      <Link to="/reminders" className="flex">
        <div className="bg-white/60 dark:bg-gray-900/60 backdrop-blur-xl rounded-xl border border-gray-100/50 dark:border-gray-800/50 shadow-soft dark:shadow-soft-dark hover:bg-white/70 dark:hover:bg-gray-900/70 hover:shadow-md transition-all duration-200 p-6 cursor-pointer flex-1 flex items-center justify-center">
          <div className="flex items-center w-full">
            <div className="p-3 bg-primary-50 dark:bg-primary-900/30 rounded-lg">
              <CalendarIcon className="h-8 w-8 text-primary-500 dark:text-primary-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Upcoming Reminders</p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">{metrics.upcomingReminders}</p>
            </div>
          </div>
        </div>
      </Link>
    </div>
  );
};

export default DashboardMetrics;