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
  CalendarIcon,
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
      <div className="bg-white rounded-xl shadow-soft p-6 hover:shadow-lg transition-shadow">
        <div className="flex items-center">
          <div className="p-3 bg-primary-50 rounded-lg">
            <UserGroupIcon className="h-8 w-8 text-primary-500" />
          </div>
          <div className="ml-4">
            <p className="text-sm font-medium text-gray-600">Total Contacts</p>
            <p className="text-2xl font-semibold text-gray-900">{metrics.totalContacts}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-soft p-6 hover:shadow-lg transition-shadow">
        <div className="flex items-center">
          <div className="p-3 bg-accent-50 rounded-lg">
            <BellIcon className="h-8 w-8 text-accent-500" />
          </div>
          <div className="ml-4">
            <p className="text-sm font-medium text-gray-600">Due Reminders</p>
            <p className="text-2xl font-semibold text-gray-900">{metrics.dueReminders}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-soft p-6 hover:shadow-lg transition-shadow">
        <div className="flex items-center">
          <div className="p-3 bg-primary-50 rounded-lg">
            <CalendarIcon className="h-8 w-8 text-primary-500" />
          </div>
          <div className="ml-4">
            <p className="text-sm font-medium text-gray-600">Upcoming Reminders</p>
            <p className="text-2xl font-semibold text-gray-900">{metrics.upcomingReminders}</p>
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
    <div className="bg-white rounded-xl shadow-soft">
      <div className="p-6 border-b border-gray-100">
        <h3 className="text-lg font-semibold text-gray-900">Recent Contacts</h3>
      </div>
      <div className="divide-y divide-gray-100">
        {contacts?.slice(0, 5).map((contact: Contact) => (
          <div key={contact.id} className="p-6 hover:bg-gray-50 transition-colors">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-base font-medium text-gray-900">{contact.name}</h4>
                <p className="text-sm text-gray-600 mt-1">
                  Last contact: {contact.last_contacted ? dayjs(contact.last_contacted).fromNow() : 'Never'}
                </p>
              </div>
              <div className="flex space-x-4">
                <button className="p-2 text-gray-500 hover:text-primary-500 hover:bg-primary-50 rounded-lg transition-colors">
                  <PhoneIcon className="h-5 w-5" />
                </button>
                <button className="p-2 text-gray-500 hover:text-primary-500 hover:bg-primary-50 rounded-lg transition-colors">
                  <EnvelopeIcon className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="p-6 border-t border-gray-100">
        <Link
          to="/contacts"
          className="inline-flex items-center text-primary-500 hover:text-primary-400 font-medium transition-colors"
        >
          View all contacts
          <svg className="w-5 h-5 ml-1" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
          </svg>
        </Link>
      </div>
    </div>
  );
};

export const Dashboard = () => {
  const { user } = useStore();

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome back, {user?.user_metadata?.name || 'Friend'}!
          </h1>
          <p className="mt-2 text-gray-600">
            Here's what's happening with your relationships
          </p>
        </div>
        <Link
          to="/contacts/new"
          className="inline-flex items-center px-5 py-2.5 rounded-lg text-sm font-medium text-white bg-primary-500 hover:bg-primary-400 shadow-soft hover:shadow-lg transition-all"
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