import { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { contactsService } from '../services/contacts';
import { useStore } from '../stores/useStore';
import {
  UserPlusIcon,
  MagnifyingGlassIcon,
  PhoneIcon,
  TrashIcon,
  PencilSquareIcon,
  ChevronUpDownIcon,
} from '@heroicons/react/24/outline';
import { AtSymbolIcon } from '@heroicons/react/24/outline';
import type { Contact, Interaction } from '../lib/supabase/types';
import { QuickInteraction } from '../components/contacts/QuickInteraction';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

type SortField = 'name' | 'last_contacted' | 'relationship_level';
type SortOrder = 'asc' | 'desc';

export const Contacts = () => {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [quickInteraction, setQuickInteraction] = useState<{
    isOpen: boolean;
    contactId: string;
    type: Interaction['type'];
    contactName: string;
  } | null>(null);

  const refetchContacts = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: ['contacts'] as const,
      exact: true,
      refetchType: 'all'
    });
  }, [queryClient]);
  const { isPremium, isOnTrial } = useStore();

  const { data: contacts, isLoading } = useQuery<Contact[]>({
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

  const filteredContacts = contacts
    ?.filter(contact =>
      contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contact.phone?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contact.social_media_handle?.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      if (sortField === 'name') {
        return sortOrder === 'asc'
          ? a.name.localeCompare(b.name)
          : b.name.localeCompare(a.name);
      }
      if (sortField === 'last_contacted') {
        const dateA = a.last_contacted ? new Date(a.last_contacted).getTime() : 0;
        const dateB = b.last_contacted ? new Date(b.last_contacted).getTime() : 0;
        return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
      }
      return sortOrder === 'asc'
        ? (a[sortField] || 0) - (b[sortField] || 0)
        : (b[sortField] || 0) - (a[sortField] || 0);
    });

  const contactLimit = isPremium || isOnTrial ? Infinity : 7;
  const canAddMore = (contacts?.length || 0) < contactLimit;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Contacts</h1>
          <p className="mt-1 text-sm text-gray-600">
            Manage your relationships and stay connected
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

      <div className="bg-white rounded-xl shadow-soft">
        <div className="p-6 border-b border-gray-100">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search contacts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 focus:border-primary-400 focus:ring-primary-400 transition-colors"
                />
              </div>
            </div>
            <div className="relative flex gap-3">
              <div className="w-full min-w-[160px] max-w-[180px]">
                <select
                  value={sortField}
                  onChange={(e) => setSortField(e.target.value as SortField)}
                  className="w-full pl-4 pr-10 py-2.5 rounded-lg border border-gray-200 focus:border-primary-400 focus:ring-primary-400 transition-colors appearance-none bg-white"
                >
                  <option value="name">Sort by Name</option>
                  <option value="last_contacted">Sort by Last Contacted</option>
                  <option value="relationship_level">Sort by Relationship Closeness</option>
                </select>
              </div>
              <button
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="flex-shrink-0 p-2.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                <ChevronUpDownIcon className="h-5 w-5 text-gray-500" />
              </button>
            </div>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {isLoading ? (
            <div className="p-12 text-center text-gray-500">
              <div className="animate-pulse">Loading contacts...</div>
            </div>
          ) : filteredContacts?.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              No contacts found
            </div>
          ) : (
            filteredContacts?.map((contact) => (
              <div key={contact.id} className="bg-white rounded-lg shadow-soft p-4 hover:shadow-md transition-shadow">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <h3 className="text-lg font-semibold text-primary-500">
                        {contact.name}
                      </h3>
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
                          <span className="text-gray-600">{contactsService.formatDueDate(contact.next_contact_due)}</span>
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
                            <span className="text-gray-700 font-medium">Preferred frequency:</span>{' '}
                            <span className="text-gray-600">{contact.contact_frequency.charAt(0).toUpperCase() + contact.contact_frequency.slice(1)}</span>
                          </span>
                        )}
                        {contact.ai_last_suggestion && (
                          <span>
                            <span className="text-gray-700 font-medium">Suggestions:</span>{' '}
                            <span className="text-gray-600 whitespace-pre-line">
                              {contact.ai_last_suggestion === 'Upgrade to premium to get advanced AI suggestions!' ? (
                                <div className="p-4 bg-gray-50 rounded-lg">
                                  <span className="text-sm text-gray-600">
                                    ✨ <Link to="/settings" className="text-primary-600 hover:text-primary-500">Upgrade to Premium</Link> to get AI-powered suggestions!
                                  </span>
                                </div>
                              ) : (
                                contact.ai_last_suggestion.split('\n').slice(0, 5).join('\n')
                              )}
                            </span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-center sm:justify-start gap-2 w-full sm:w-auto mt-3 sm:mt-0">
                    <button
                      onClick={() => setQuickInteraction({ isOpen: true, contactId: contact.id, type: 'call', contactName: contact.name })}
                      className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-white bg-primary-500 hover:bg-primary-400 rounded-lg shadow-sm hover:shadow transition-all"
                      title="Log an interaction"
                    >
                      Log Interaction
                    </button>
                    {(isPremium || isOnTrial) ? (
                      <Link
                        to={`/contacts/${contact.id}/interactions`}
                        className="inline-flex items-center justify-center text-center px-3 py-1.5 text-sm font-medium text-primary-600 bg-primary-50 hover:bg-primary-100 rounded-lg shadow-sm hover:shadow transition-all"
                        title="View interaction history"
                      >
                        View History
                      </Link>
                    ) : (
                      <Link
                        to={`/contacts/${contact.id}/interactions`}
                        className="inline-flex items-center justify-center text-center px-3 py-1.5 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg shadow-sm hover:shadow transition-all"
                        title="Upgrade to view interaction history"
                      >
                        View History
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      {quickInteraction && (
        <QuickInteraction
          isOpen={quickInteraction.isOpen}
          onClose={() => setQuickInteraction(null)}
          contactId={quickInteraction.contactId}
          contactName={quickInteraction.contactName}
          defaultType={quickInteraction.type}
          onSuccess={refetchContacts}
        />
      )}
    </div>
  );
};

export default Contacts;
