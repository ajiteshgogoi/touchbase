import { useState, useCallback, useEffect, lazy, Suspense } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { contactsService } from '../services/contacts';
import { useStore } from '../stores/useStore';
import {
  UserPlusIcon,
  MagnifyingGlassIcon,
  ChevronUpDownIcon,
  ArrowLeftIcon,
} from '@heroicons/react/24/outline/esm/index.js';
import type { Contact, Interaction, ImportantEvent } from '../lib/supabase/types';
import { extractHashtags, formatHashtagForDisplay } from '../components/contacts/utils';
import { ContactCard } from '../components/contacts/ContactCard';
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

  const handleDeleteContact = async (contactId: string) => {
    try {
      await contactsService.deleteContact(contactId);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['contacts'], exact: true }),
        queryClient.invalidateQueries({ queryKey: ['contactsCount'], exact: true }),
        queryClient.invalidateQueries({ queryKey: ['reminders'], exact: true })
      ]);
    } catch (error) {
      console.error('Error deleting contact:', error);
      throw error; // Propagate error to ContactCard for error handling
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
          <div className="flex flex-col gap-4">
            <div className="flex flex-1 flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <div className="relative">
                  <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search contacts..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-400 hover:border-gray-300 transition-colors bg-white/60 backdrop-blur-sm"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2 sm:w-auto">
                <div className="flex-1">
                  <select
                    value={sortField}
                    onChange={(e) => setSortField(e.target.value as SortField)}
                    className="w-full pl-4 pr-10 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-400 hover:border-gray-300 transition-colors appearance-none bg-white/60 backdrop-blur-sm text-sm"
                    aria-label="Sort contacts by"
                  >
                    <option value="name">Sort by Name</option>
                    <option value="last_contacted">Sort by Last Contacted</option>
                    <option value="missed_interactions">Sort by Missed Interactions</option>
                  </select>
                </div>
                <button
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                  className="flex-shrink-0 p-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 focus:outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-400 transition-colors"
                  aria-label={sortOrder === 'asc' ? 'Sort descending' : 'Sort ascending'}
                >
                  <ChevronUpDownIcon className="h-5 w-5 text-gray-500" />
                </button>
              </div>
            </div>
            {allHashtags.length > 0 && (
              <div>
                <div className="flex flex-wrap gap-2">
                  {allHashtags.map((tag, index) => (
                    <button
                      key={index}
                      onClick={() => handleCategoryChange(tag)}
                      className={`px-3 py-1.5 rounded-xl text-sm ${selectedCategories.includes(tag)
                          ? 'bg-primary-100 text-primary-700 border-primary-200 shadow-sm'
                          : 'bg-white/60 backdrop-blur-sm text-gray-600 hover:bg-white/70 border-gray-200'
                        } border transition-all`}
                    >
                      {formatHashtagForDisplay(tag)}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
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
              <ContactCard
                key={contact.id}
                contact={contact}
                eventsMap={eventsMap}
                isPremium={isPremium}
                isOnTrial={isOnTrial}
                onDelete={handleDeleteContact}
                onQuickInteraction={({ contactId, type, contactName }) =>
                  setQuickInteraction({
                    isOpen: true,
                    contactId,
                    type,
                    contactName
                  })}
              />
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