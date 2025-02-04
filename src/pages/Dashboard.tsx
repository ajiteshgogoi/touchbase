import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { contactsService } from '../services/contacts';
import { useStore } from '../stores/useStore';
import {
  UserPlusIcon,
  UserGroupIcon,
  CalendarIcon,
  PhoneIcon,
  AtSymbolIcon,
  PencilSquareIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import type { Contact, Reminder, Interaction } from '../lib/supabase/types';
import { QuickInteraction } from '../components/contacts/QuickInteraction';

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
    upcomingReminders: reminders?.filter((r: Reminder) =>
      dayjs(r.due_date).isAfter(dayjs())
    ).length || 0,
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
      <Link to="/contacts" className="block">
        <div className="bg-white rounded-xl shadow-soft p-6 hover:shadow-lg transition-shadow cursor-pointer">
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
      </Link>

      <Link to="/reminders" className="block">
        <div className="bg-white rounded-xl shadow-soft p-6 hover:shadow-lg transition-shadow cursor-pointer">
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
      </Link>
    </div>
  );
};

const RecentContacts = () => {
  const queryClient = useQueryClient();
  const { data: contacts } = useQuery<Contact[]>({
    queryKey: ['contacts'],
    queryFn: contactsService.getContacts
  });

  const handleDeleteContact = async (contactId: string) => {
    if (confirm('Are you sure you want to delete this contact?')) {
      try {
        await contactsService.deleteContact(contactId);
        // Invalidate both contacts and reminders queries
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: ['contacts'],
            exact: true,
            refetchType: 'all'
          }),
          queryClient.invalidateQueries({
            queryKey: ['reminders'],
            exact: true,
            refetchType: 'all'
          })
        ]);
      } catch (error) {
        console.error('Error deleting contact:', error);
      }
    }
  };

  const [quickInteraction, setQuickInteraction] = useState<{
    isOpen: boolean;
    contactId: string;
    contactName: string;
    type: Interaction['type'];
  } | null>(null);

  return (
    <>
      <div className="space-y-4">
        <div>
          <h3 className="text-xl font-bold text-gray-900">Recent Contacts</h3>
          <p className="mt-1 text-sm text-gray-600">
            Your most recently added connections
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-soft">
          <div className="divide-y divide-gray-100">
            {contacts?.slice(0, 3).map((contact: Contact) => (
              <div key={contact.id} className="bg-white rounded-lg shadow-soft p-4 hover:shadow-md transition-shadow">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <h3 className="text-lg font-semibold text-primary-500">{contact.name}</h3>
                      <div className="flex flex-wrap gap-2">
                        <Link
                          to={`/contacts/${contact.id}/edit`}
                          className="inline-flex items-center p-1.5 text-gray-500 hover:text-primary-500 hover:bg-primary-50 rounded-lg transition-colors"
                          title="Edit contact"
                        >
                          <PencilSquareIcon className="h-4 w-4" />
                        </Link>
                        <button
                          onClick={() => handleDeleteContact(contact.id)}
                          className="inline-flex items-center p-1.5 text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete contact"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    <div className="mt-3 space-y-2.5">
                      <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                        {contact.phone && (
                          <span className="inline-flex items-center">
                            <PhoneIcon className="h-4 w-4 mr-1.5 text-green-500 flex-shrink-0" />
                            <span className="truncate leading-5">{contact.phone}</span>
                          </span>
                        )}
                        {contact.social_media_handle && (
                          <span className="inline-flex items-center">
                            <AtSymbolIcon className="h-4 w-4 mr-1.5 text-pink-500 flex-shrink-0" />
                            <span className="truncate leading-5">{contact.social_media_handle}</span>
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-4 text-sm">
                        <span>
                          <span className="text-gray-700 font-medium">Last contacted:</span>{' '}
                          <span className="text-gray-600">{contact.last_contacted ? dayjs(contact.last_contacted).fromNow() : 'Never'}</span>
                        </span>
                        <span>
                          <span className="text-gray-700 font-medium">Next contact due:</span>{' '}
                          <span className="text-gray-600">{contact.next_contact_due ? dayjs(contact.next_contact_due).fromNow() : 'Not set'}</span>
                        </span>
                        <span className="inline-flex items-baseline">
                          <span className="text-gray-700 font-medium">Closeness:</span> <div className={`inline-flex items-center justify-center w-2.5 h-2.5 rounded-full ml-1.5 translate-y-[0.5px] ${
                            contact.relationship_level === 1 ? 'bg-red-400' :
                            contact.relationship_level === 2 ? 'bg-[#f87171]' :
                            contact.relationship_level === 3 ? 'bg-[#fbbf24]' :
                            contact.relationship_level === 4 ? 'bg-[#34d399]' :
                            'bg-green-400'
                          }`}></div>
                        </span>
                        {contact.contact_frequency && (
                          <span>
                            <span className="text-gray-700 font-medium">Frequency:</span>{' '}
                            <span className="text-gray-600">{contact.contact_frequency.charAt(0).toUpperCase() + contact.contact_frequency.slice(1)}</span>
                          </span>
                        )}
                        {contact.ai_last_suggestion && (
                          <span>
                            <span className="text-gray-700 font-medium">Suggestions:</span>{' '}
                            <span className="text-gray-600 whitespace-pre-line">
                              {contact.ai_last_suggestion.split('\n').slice(0, 5).join('\n')}
                            </span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center sm:self-start mt-3 sm:mt-0">
                    <button
                      onClick={() => setQuickInteraction({
                        isOpen: true,
                        contactId: contact.id,
                        contactName: contact.name,
                        type: 'call'
                      })}
                      className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-white bg-primary-500 hover:bg-primary-400 rounded-lg shadow-sm hover:shadow transition-all"
                      title="Log an interaction"
                    >
                      Log Interaction
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
      </div>
      {quickInteraction && (
        <QuickInteraction
          isOpen={quickInteraction.isOpen}
          onClose={() => setQuickInteraction(null)}
          contactId={quickInteraction.contactId}
          contactName={quickInteraction.contactName}
          defaultType={quickInteraction.type}
        />
      )}
    </>
  );
};

export const Dashboard = () => {
  const { user, isPremium } = useStore();
  const { data: contacts } = useQuery<Contact[]>({
    queryKey: ['contacts'],
    queryFn: contactsService.getContacts
  });
  const contactLimit = isPremium ? Infinity : 5;
  const canAddMore = (contacts?.length || 0) < contactLimit;

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome back, {user?.user_metadata?.name || 'Friend'}!
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Here's what's happening with your relationships
          </p>
        </div>
        {canAddMore ? (
          <Link
            to="/contacts/new"
            className="inline-flex items-center justify-center w-full sm:w-auto px-5 py-2.5 rounded-lg text-sm font-medium text-white bg-primary-500 hover:bg-primary-400 shadow-soft hover:shadow-lg transition-all"
          >
            <UserPlusIcon className="h-5 w-5 mr-2" />
            Add Contact
          </Link>
        ) : (
          <button className="inline-flex items-center justify-center w-full sm:w-auto px-5 py-2.5 rounded-lg text-sm font-medium text-white bg-gray-400 cursor-not-allowed shadow-soft">
            Upgrade to add more contacts
          </button>
        )}
      </div>

      <DashboardMetrics />

      <div className="grid grid-cols-1 gap-6">
        <RecentContacts />
        {/* Add Upcoming Reminders component here */}
      </div>
    </div>
  );
};

export default Dashboard;