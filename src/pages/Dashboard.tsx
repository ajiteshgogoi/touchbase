import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { contactsService } from '../services/contacts';
import { useStore } from '../stores/useStore';
import {
  UserPlusIcon,
  BellIcon,
  PhoneIcon,
  EnvelopeIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import type { Contact, Reminder } from '../lib/supabase/types';

dayjs.extend(relativeTime);

const DashboardMetrics = () => {
  const { data: contacts } = useQuery({
    queryKey: ['contacts'],
    queryFn: contactsService.getContacts
  });

  const { data: reminders } = useQuery({
    queryKey: ['reminders'],
    queryFn: () => contactsService.getReminders()
  });

  const metrics = {
    totalContacts: contacts?.length || 0,
    dueReminders: reminders?.filter((r: Reminder) => 
      !r.is_completed && dayjs(r.due_date).isBefore(dayjs())
    ).length || 0,
    upcomingReminders: reminders?.filter((r: Reminder) => 
      !r.is_completed && dayjs(r.due_date).isAfter(dayjs())
    ).length || 0,
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex items-center">
          <UserGroupIcon className="h-8 w-8 text-primary-600" />
          <div className="ml-4">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Contacts</p>
            <p className="text-2xl font-semibold text-gray-900 dark:text-white">{metrics.totalContacts}</p>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex items-center">
          <BellIcon className="h-8 w-8 text-yellow-600" />
          <div className="ml-4">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Due Reminders</p>
            <p className="text-2xl font-semibold text-gray-900 dark:text-white">{metrics.dueReminders}</p>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex items-center">
          <BellIcon className="h-8 w-8 text-green-600" />
          <div className="ml-4">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Upcoming Reminders</p>
            <p className="text-2xl font-semibold text-gray-900 dark:text-white">{metrics.upcomingReminders}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

const RecentContacts = () => {
  const { data: contacts } = useQuery<Contact[]>({
    queryKey: ['contacts'],
    queryFn: contactsService.getContacts
  });

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">Recent Contacts</h3>
      </div>
      <div className="divide-y divide-gray-200 dark:divide-gray-700">
        {contacts?.slice(0, 5).map((contact: Contact) => (
          <div key={contact.id} className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium text-gray-900 dark:text-white">{contact.name}</h4>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Last contact: {contact.last_contacted ? dayjs(contact.last_contacted).fromNow() : 'Never'}
                </p>
              </div>
              <div className="flex space-x-3">
                <button className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300">
                  <PhoneIcon className="h-5 w-5" />
                </button>
                <button className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300">
                  <EnvelopeIcon className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="p-6 border-t border-gray-200 dark:border-gray-700">
        <Link
          to="/contacts"
          className="text-primary-600 hover:text-primary-500 text-sm font-medium"
        >
          View all contacts
        </Link>
      </div>
    </div>
  );
};

export const Dashboard = () => {
  const { user } = useStore();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            Welcome back, {user?.user_metadata?.name || 'Friend'}!
          </h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Here's what's happening with your contacts
          </p>
        </div>
        <Link
          to="/contacts/new"
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700"
        >
          <UserPlusIcon className="h-5 w-5 mr-2" />
          Add Contact
        </Link>
      </div>

      <DashboardMetrics />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RecentContacts />
        {/* Add Upcoming Reminders component here */}
      </div>
    </div>
  );
};

export default Dashboard;