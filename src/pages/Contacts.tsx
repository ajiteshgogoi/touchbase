import { useState, useCallback, useEffect, lazy, Suspense } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { contactsService } from '../services/contacts';
import { contentReportsService } from '../services/content-reports';
import { useStore } from '../stores/useStore';
import { LoadingSpinner } from '../components/shared/LoadingSpinner';
import {
  UserPlusIcon,
  MagnifyingGlassIcon,
  PhoneIcon,
  TrashIcon,
  PencilSquareIcon,
  ChevronUpDownIcon,
  ArrowLeftIcon,
  FlagIcon,
  AtSymbolIcon,
  CakeIcon,
  HeartIcon,
  StarIcon
} from '@heroicons/react/24/outline/esm/index.js';
import type { Contact, Interaction, ImportantEvent } from '../lib/supabase/types';
import {
  getEventTypeDisplay,
  formatEventDate,
  sortEventsByType,
  extractHashtags,
  formatHashtagForDisplay
} from '../components/contacts/utils';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

// Lazy load QuickInteraction
const QuickInteraction = lazy(() => import('../components/contacts/QuickInteraction'));

dayjs.extend(relativeTime);

type SortField = 'name' | 'last_contacted' | 'missed_interactions';
type SortOrder = 'asc' | 'desc';

export const Contacts = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
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

  const { data: contacts, isLoading: contactsLoading } = useQuery<Contact[]>({
    queryKey: ['contacts'],
    queryFn: contactsService.getContacts,
    staleTime: 5 * 60 * 1000
  });

  const { data: totalCount, isLoading: countLoading } = useQuery<number>({
    queryKey: ['contactsCount'],
    queryFn: contactsService.getTotalContactCount,
    // Only fetch total count for free users
    enabled: !isPremium && !isOnTrial
  });

  const { data: importantEvents } = useQuery<ImportantEvent[]>({
    queryKey: ['important-events'],
    queryFn: () => contactsService.getImportantEvents(),
    staleTime: 5 * 60 * 1000
  });

  // Map of contact ID to their events
  const eventsMap = importantEvents?.reduce((acc, event) => {
    if (event) {
      const contactId = event.contact_id as string;
      if (!acc[contactId]) {
        acc[contactId] = [];
      }
      acc[contactId].push(event);
    }
    return acc;
  }, {} as Record<string, ImportantEvent[]>) || {};

  const isLoading = contactsLoading || countLoading;

  // Calculate all unique hashtags from contacts
  const allHashtags = contacts?.reduce((tags: string[], contact) => {
    const contactTags = extractHashtags(contact.notes || '');
    return [...new Set([...tags, ...contactTags])];
  }, []) || [];

  const handleCategoryChange = (hashtag: string) => {
    setSelectedCategories(prev => {
      if (prev.includes(hashtag)) {
        return prev.filter(h => h !== hashtag);
      }
      return [...prev, hashtag];
    });
  };

  useEffect(() => {
    // If there's no hash, scroll to top when component mounts
    if (!window.location.hash) {
      window.scrollTo(0, 0);
    }
  }, []);

  // Handle scrolling to contact when hash changes
  useEffect(() => {
    const hash = window.location.hash.slice(1); // Remove the # symbol
    if (hash) {
      const element = document.getElementById(hash);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, [window.location.hash]);

  const handleReportContent = async (contactId: string, content: string) => {
    if (confirm('Report this AI suggestion as inappropriate?')) {
      try {
        await contentReportsService.reportContent(content, {
          contactId,
          contentType: 'suggestion'
        });
        alert('Thank you for reporting. We will review this suggestion.');
      } catch (error) {
        console.error('Error reporting content:', error);
        alert('Failed to report content. Please try again.');
      }
    }
  };

  const [deletingContactId, setDeletingContactId] = useState<string | null>(null);

  const handleDeleteContact = async (contactId: string) => {
    if (confirm('Are you sure you want to delete this contact?')) {
      try {
        setDeletingContactId(contactId);
        await contactsService.deleteContact(contactId);
        
        // Directly invalidate queries to fetch fresh data
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: ['contacts'],
            exact: true
          }),
          queryClient.invalidateQueries({
            queryKey: ['contactsCount'],
            exact: true
          }),
          queryClient.invalidateQueries({
            queryKey: ['reminders'],
            exact: true
          })
        ]);
      } catch (error) {
        console.error('Error deleting contact:', error);
      } finally {
        setDeletingContactId(null);
      }
    }
  };

  const filteredContacts = contacts
    ?.filter(contact => {
      // Search query filter
      const matchesSearch =
        contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        contact.phone?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        contact.social_media_handle?.toLowerCase().includes(searchQuery.toLowerCase());

      // Category filter
      const matchesCategories = selectedCategories.length === 0 ||
        selectedCategories.every(category =>
          extractHashtags(contact.notes || '').includes(category.toLowerCase())
        );

      return matchesSearch && matchesCategories;
    })
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

  const contactLimit = isPremium || isOnTrial ? Infinity : 15;
  const canAddMore = (contacts?.length || 0) < contactLimit;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
              className="p-2.5 -m-2.5 text-gray-400 hover:text-primary-500 hover:bg-gray-50/70 rounded-xl transition-all duration-200"
              aria-label="Go back"
            >
              <ArrowLeftIcon className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-primary-600 to-primary-400 bg-clip-text text-transparent">Contacts</h1>
              <p className="mt-1.5 text-[15px] text-gray-600/90">
                Keep your relationships intentional with a focused contact list
              </p>
            </div>
          </div>
        </div>
        {canAddMore ? (
          <Link
            to="/contacts/new"
            state={{ from: '/contacts' }}
            className="inline-flex items-center justify-center w-full sm:w-auto px-5 py-3 rounded-xl text-[15px] font-[500] text-white bg-primary-500 hover:bg-primary-600 shadow-soft hover:shadow-lg active:scale-[0.98] transition-all duration-200"
          >
            <UserPlusIcon className="h-5 w-5 mr-2" />
            Add Contact
          </Link>
        ) : (
          <Link
            to="/settings"
            className="inline-flex items-center justify-center w-full sm:w-auto px-5 py-3 rounded-xl text-[15px] font-[500] text-white bg-gray-400 hover:bg-gray-500 shadow-soft hover:shadow-lg active:scale-[0.98] transition-all duration-200"
          >
            Upgrade to add more contacts
          </Link>
        )}
      </div>

      <div className="bg-white/60 backdrop-blur-xl rounded-xl border border-gray-100/50 shadow-soft">
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
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 focus:outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-400 hover:border-gray-300 transition-colors"
                />
              </div>
            </div>
            <div className="flex items-center gap-2 sm:w-auto">
              <div className="flex-1">
                <select
                  value={sortField}
                  onChange={(e) => setSortField(e.target.value as SortField)}
                  className="w-full pl-4 pr-10 py-2.5 rounded-lg border border-gray-200 focus:outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-400 hover:border-gray-300 transition-colors appearance-none bg-white text-sm"
                  aria-label="Sort contacts by"
                >
                  <option value="name">Sort by Name</option>
                  <option value="last_contacted">Sort by Last Contacted</option>
                  <option value="missed_interactions">Sort by Missed Interactions</option>
                </select>
              </div>
              <button
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="flex-shrink-0 p-2.5 rounded-lg border border-gray-200 hover:bg-gray-50 focus:outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-400 transition-colors"
                aria-label={sortOrder === 'asc' ? 'Sort descending' : 'Sort ascending'}
              >
                <ChevronUpDownIcon className="h-5 w-5 text-gray-500" />
              </button>
            </div>
          </div>
          {allHashtags.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-4">
              <div className="w-full">
                <span className="text-xs font-[500] text-gray-500 uppercase tracking-wider">Filter by Category:</span>
              </div>
              {allHashtags.map((tag, index) => (
                <button
                  key={index}
                  onClick={() => handleCategoryChange(tag)}
                  className={`px-3 py-1.5 rounded-full text-sm ${
                    selectedCategories.includes(tag)
                      ? 'bg-primary-100 text-primary-700 border-primary-200'
                      : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border-gray-100'
                  } border transition-colors`}
                >
                  {formatHashtagForDisplay(tag)}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 space-y-4">
          {/* Show banner only to free users when total contacts exceed 15 */}
          {!isPremium && !isOnTrial && !countLoading && totalCount !== undefined && totalCount > 15 && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg mb-4">
              <p className="text-sm text-amber-800">
                You're seeing your 15 most recent contacts. {' '}
                <Link to="/settings" className="font-medium text-amber-900 underline hover:no-underline">
                  Upgrade to Premium
                </Link>{' '}
                to manage all {totalCount} of your contacts.
              </p>
            </div>
          )}
          {isLoading ? (
            <div className="p-12 text-center">
              <div className="flex flex-col items-center justify-center gap-3 text-primary-500/90">
                <svg className="animate-spin h-8 w-8" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span className="text-base font-medium text-gray-600">Loading contacts...</span>
              </div>
            </div>
          ) : filteredContacts?.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              No contacts found
            </div>
          ) : (
            // For free users, only show first 15 contacts after filtering
            (isPremium || isOnTrial ? filteredContacts : filteredContacts?.slice(0, 15))?.map((contact) => (
              <div
                key={contact.id}
                id={contact.id}
                className="bg-white/60 backdrop-blur-xl rounded-xl border border-gray-100/50 shadow-soft p-3 sm:p-4 hover:bg-white/70 hover:shadow-md transition-all duration-200 scroll-mt-6"
              >
                <div className="flex flex-col gap-4 divide-y divide-gray-100">
                  <div className="min-w-0 pb-3">
                    <div className="flex justify-between items-start">
                      <div className="space-y-1.5">
                        <h3 className="text-xl sm:text-2xl font-semibold text-primary-500 tracking-[-0.01em]">
                          {contact.name}
                        </h3>
                        {/* Inline status indicator */}
                        <div className="flex items-center text-[13px] sm:text-sm text-gray-500/90">
                          <div className={`w-2 h-2 rounded-full mr-2 transition-colors ${
                            contact.missed_interactions > 3 ? 'bg-red-400/90' :
                            contact.missed_interactions > 2 ? 'bg-orange-400/90' :
                            contact.missed_interactions > 1 ? 'bg-yellow-400/90' :
                            contact.missed_interactions > 0 ? 'bg-lime-400/90' :
                            'bg-green-400/90'
                          }`} title={`${contact.missed_interactions} missed interactions`}></div>
                          {contact.contact_frequency && (
                            <span className="font-[450]">
                              {contact.contact_frequency === 'every_three_days'
                                ? 'Bi-weekly contact'
                                : contact.contact_frequency.charAt(0).toUpperCase() + contact.contact_frequency.slice(1).replace(/_/g, ' ') + ' contact'}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2 ml-4">
                        <Link
                          to={`/contacts/${contact.id}/edit`}
                          state={{ from: '/contacts' }}
                          className="inline-flex items-center p-1.5 text-gray-500 hover:text-primary-500 hover:bg-primary-50 rounded-lg transition-colors"
                          title="Edit contact"
                        >
                          <PencilSquareIcon className="h-4 w-4" />
                        </Link>
                        <button
                          onClick={() => handleDeleteContact(contact.id)}
                          disabled={deletingContactId === contact.id}
                          className={`inline-flex items-center p-1.5 rounded-lg transition-colors ${
                            deletingContactId === contact.id
                            ? 'text-gray-400 bg-gray-100'
                            : 'text-gray-500 hover:text-red-500 hover:bg-red-50'
                          }`}
                          title={deletingContactId === contact.id ? 'Deleting contact...' : 'Delete contact'}
                        >
                          {deletingContactId === contact.id ? (
                            <div className="h-4 w-4 flex items-center justify-center">
                              <div className="transform scale-50 -m-2">
                                <LoadingSpinner />
                              </div>
                            </div>
                          ) : (
                            <TrashIcon className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>
                    <div className="mt-4">
                      {/* Contact details section */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-sm text-gray-600/90 mb-4">
                        {contact.phone && (
                          <div className="flex items-center px-3 py-2 bg-white/60 backdrop-blur-sm rounded-lg border border-gray-100/50 hover:bg-white/70 transition-colors duration-200">
                            <PhoneIcon className="h-4 w-4 mr-2 text-green-500/90 flex-shrink-0" />
                            <span className="truncate leading-5 font-[450]">{contact.phone}</span>
                          </div>
                        )}
                        {contact.social_media_handle && (
                          <div className="flex items-center px-3 py-2 bg-white/60 backdrop-blur-sm rounded-lg border border-gray-100/50 hover:bg-white/70 transition-colors duration-200">
                            <AtSymbolIcon className="h-4 w-4 mr-2 text-pink-500/90 flex-shrink-0" />
                            <span className="truncate leading-5 font-[450]">{contact.social_media_handle}</span>
                          </div>
                        )}
                      </div>
                      
                      {/* Events section */}
                      {(eventsMap[contact.id] || []).length > 0 && (
                        <div className="mb-4 bg-gray-50 rounded-lg overflow-hidden">
                          <div className="px-3 py-2 bg-gray-100">
                            <span className="text-xs font-[500] text-gray-500/90 uppercase tracking-wider">Important Dates</span>
                          </div>
                          <div className="px-3 py-2">
                            <div className="flex flex-wrap gap-2.5 text-sm min-w-0">
                              {sortEventsByType(eventsMap[contact.id] || []).map((event: ImportantEvent, idx: number) => (
                                <span key={idx} className="inline-flex items-center flex-wrap">
                                  {event.type === 'birthday' ? (
                                    <CakeIcon className="h-4 w-4 mr-1.5 text-pink-500 flex-shrink-0" />
                                  ) : event.type === 'anniversary' ? (
                                    <HeartIcon className="h-4 w-4 mr-1.5 text-rose-500 flex-shrink-0" />
                                  ) : (
                                    <StarIcon className="h-4 w-4 mr-1.5 text-purple-500 flex-shrink-0" />
                                  )}
                                  <span className="text-gray-700 font-medium break-words">{event.type === 'custom' ? event.name : getEventTypeDisplay(event.type)}:&nbsp;</span>
                                  <span className="text-gray-600 break-words">{formatEventDate(event.date)}</span>
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {/* Contact status section */}
                      <div className="mb-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          <div className="bg-gray-50 rounded-lg overflow-hidden">
                            <div className="px-3 py-2 bg-gray-100">
                              <span className="text-xs font-[500] text-gray-500/90 uppercase tracking-wider">Last Contacted</span>
                            </div>
                            <div className="px-3 py-2">
                              <span className="text-[13px] sm:text-sm font-[450] text-gray-700/90">{contact.last_contacted ? dayjs(contact.last_contacted).fromNow() : 'Never'}</span>
                            </div>
                          </div>
                          <div className="bg-gray-50 rounded-lg overflow-hidden">
                            <div className="px-3 py-2 bg-gray-100">
                              <span className="text-xs font-[500] text-gray-500/90 uppercase tracking-wider">Next Contact Due</span>
                            </div>
                            <div className="px-3 py-2">
                              <span className="text-[13px] sm:text-sm font-[450] text-gray-700/90">{contactsService.formatDueDate(contact.next_contact_due)}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* AI Suggestions section */}
                      <div className="bg-gray-50 rounded-lg overflow-hidden">
                        <div className="px-3 py-2 bg-gray-100">
                          <span className="text-xs font-[500] text-gray-500/90 uppercase tracking-wider">Suggestions</span>
                        </div>
                        <div className="px-3 py-2">
                          {!contact.ai_last_suggestion ? (
                            <div className="flex items-start gap-2">
                              <span className="flex-1 text-[13px] sm:text-sm text-gray-700/90 font-[450]">
                                No suggestions available
                              </span>
                            </div>
                          ) : contact.ai_last_suggestion === 'Upgrade to Premium to get personalised suggestions!' ? (
                            <div className="flex items-center gap-2">
                              <span className="text-[13px] sm:text-sm text-gray-600/90">
                                ✨ <Link to="/settings" className="text-primary-600 hover:text-primary-500 font-[500]">Upgrade to Premium</Link> to get personalised suggestions!
                              </span>
                            </div>
                          ) : (
                            <div className="group flex items-start gap-2">
                              <span className="flex-1 text-[13px] sm:text-sm text-gray-700/90 whitespace-pre-line font-[450] leading-relaxed">
                                {contact.ai_last_suggestion.split('\n').slice(0, 5).join('\n')}
                              </span>
                              {contact.ai_last_suggestion && (
                                <button
                                  onClick={() => handleReportContent(contact.id, contact.ai_last_suggestion!)}
                                  className="flex-shrink-0 p-1 text-gray-300 hover:text-red-400 transition-colors"
                                  title="Report inappropriate suggestion"
                                >
                                  <FlagIcon className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      </div>
                    </div>
                    <div className="pt-3">
                      <div className="flex flex-wrap items-center justify-start gap-2 w-full bg-white/60 backdrop-blur-sm px-3 sm:px-4 py-3 rounded-lg border border-gray-100/50">
                        <button
                          onClick={() => setQuickInteraction({ isOpen: true, contactId: contact.id, type: 'call', contactName: contact.name })}
                          className="inline-flex items-center px-3.5 py-2 text-[13px] sm:text-sm font-[500] text-white bg-primary-500 hover:bg-primary-600 active:scale-[0.98] rounded-lg shadow-sm hover:shadow-md transition-all duration-200"
                          title="Log an interaction"
                        >
                          Log Interaction
                        </button>
                        {(isPremium || isOnTrial) ? (
                          <Link
                            to={`/contacts/${contact.id}/interactions`}
                            className="inline-flex items-center justify-center text-center px-3.5 py-2 text-[13px] sm:text-sm font-[500] text-primary-600 bg-primary-50/90 hover:bg-primary-100/90 active:scale-[0.98] rounded-lg shadow-sm hover:shadow-md transition-all duration-200"
                            title="View interaction history"
                          >
                            View History
                          </Link>
                        ) : (
                          <Link
                            to={`/contacts/${contact.id}/interactions`}
                            className="inline-flex items-center justify-center text-center px-3.5 py-2 text-[13px] sm:text-sm font-[500] text-gray-600 bg-gray-100/90 hover:bg-gray-200/90 active:scale-[0.98] rounded-lg shadow-sm hover:shadow-md transition-all duration-200"
                            title="Upgrade to view interaction history"
                          >
                            View History
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
        {quickInteraction && (
          <Suspense fallback={<div className="fixed inset-0 bg-gray-500/30 flex items-center justify-center">
            <div className="animate-pulse bg-white rounded-lg p-6">Loading...</div>
          </div>}>
            <QuickInteraction
              isOpen={quickInteraction.isOpen}
              onClose={() => setQuickInteraction(null)}
              contactId={quickInteraction.contactId}
              contactName={quickInteraction.contactName}
              defaultType={quickInteraction.type}
              onSuccess={refetchContacts}
            />
          </Suspense>
        )}
      </div>
    );
  };

  export default Contacts;
