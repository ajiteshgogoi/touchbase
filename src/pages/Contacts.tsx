import { useState, lazy, Suspense, useMemo } from 'react';
import { useDebounce } from '../hooks/useDebounce';
import { Link, useNavigate } from 'react-router-dom';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { contactsService } from '../services/contacts';
import { contactsPaginationService } from '../services/pagination';
import { useStore } from '../stores/useStore';
import { VirtualizedContactList } from '../components/contacts/VirtualizedContactList';
import {
  UserPlusIcon,
  MagnifyingGlassIcon,
  ChevronUpDownIcon,
  ArrowLeftIcon,
  UsersIcon,
} from '@heroicons/react/24/outline/esm/index.js';
import { BulkImportModal } from '../components/contacts/BulkImportModal';
import type { BasicContact, Interaction, ImportantEvent } from '../lib/supabase/types';
import { formatHashtagForDisplay } from '../components/contacts/utils';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
// Lazy load QuickInteraction
const QuickInteraction = lazy(() => import('../components/contacts/QuickInteraction'));

dayjs.extend(relativeTime);

type SortField = 'name' | 'last_contacted' | 'missed_interactions';
type SortOrder = 'asc' | 'desc';
type QuickInteractionParams = {
  contactId: string;
  type: Interaction['type'];
  contactName: string;
};

export const Contacts = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [quickInteraction, setQuickInteraction] = useState<{
    isOpen: boolean;
    contactId: string;
    type: Interaction['type'];
    contactName: string;
  } | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const { isPremium, isOnTrial } = useStore();

  const handleImportMethod = async (method: 'google' | 'csv_upload' | 'csv_template') => {
    setIsImporting(true);
    try {
      switch (method) {
        case 'csv_template':
          window.open('/contacts_template.csv', '_blank');
          setShowImportModal(false);
          break;
        case 'google':
          // TODO: Implement Google Contacts import
          break;
        case 'csv_upload':
          // TODO: Implement CSV upload
          break;
      }
    } catch (error) {
      console.error('Import error:', error);
    } finally {
      setIsImporting(false);
    }
  };

  // Fetch contacts with infinite scroll
  const {
    data: contactsData,
    isLoading,
    fetchNextPage,
    hasNextPage,
    refetch
  } = useInfiniteQuery<{
    contacts: BasicContact[];
    hasMore: boolean;
    total: number;
  }>({
    queryKey: ['contacts', debouncedSearchQuery, selectedCategories, sortField, sortOrder],
    queryFn: async ({ pageParam = 0 }) => {
      const result = await contactsPaginationService.getFilteredContacts(
        pageParam as number,
        { field: sortField, order: sortOrder },
        {
          search: debouncedSearchQuery,
          categories: selectedCategories
        }
      );
      return result;
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage.hasMore) return undefined;
      return allPages.length;
    },
    staleTime: 5 * 60 * 1000
  });

  // Memoize contacts array to prevent unnecessary flattening on each render
  const contacts: BasicContact[] = useMemo(() =>
    contactsData?.pages?.flatMap(page => page.contacts) || [],
    [contactsData?.pages]
  );
  const totalCount = contactsData?.pages?.[0]?.total || 0;

  // Get important events
  const { data: importantEvents } = useQuery<ImportantEvent[]>({
    queryKey: ['important-events'],
    queryFn: () => contactsService.getImportantEvents(),
    staleTime: 5 * 60 * 1000
  });

  // Memoize events map to prevent rebuilding on every render
  const eventsMap = useMemo(() => {
    return (importantEvents || []).reduce((acc: Record<string, ImportantEvent[]>, event) => {
      const contactId = event.contact_id as string;
      if (!acc[contactId]) {
        acc[contactId] = [];
      }
      acc[contactId].push(event);
      return acc;
    }, {});
  }, [importantEvents]);

  // Get all unique hashtags from all contacts
  const { data: allHashtags = [] } = useQuery({
    queryKey: ['contact-hashtags'],
    queryFn: () => contactsPaginationService.getUniqueHashtags(),
    staleTime: 5 * 60 * 1000
  });

  const handleCategoryChange = (hashtag: string) => {
    setSelectedCategories(prev => {
      if (prev.includes(hashtag)) {
        return prev.filter(h => h !== hashtag);
      }
      return [...prev, hashtag];
    });
  };

  const handleDeleteContact = async (contactId: string) => {
    try {
      await contactsService.deleteContact(contactId);
      await refetch();
    } catch (error) {
      console.error('Error deleting contact:', error);
      throw error;
    }
  };

  const contactLimit = isPremium || isOnTrial ? Infinity : 15;
  const canAddMore = totalCount < contactLimit;

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
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => setShowImportModal(true)}
              className="inline-flex items-center justify-center w-full sm:w-auto px-5 py-3 rounded-xl text-[15px] font-[500] text-white bg-primary-500 hover:bg-primary-600 shadow-soft hover:shadow-lg active:scale-[0.98] transition-all duration-200"
            >
              <UsersIcon className="h-5 w-5 mr-2" />
              Bulk Import
            </button>
            <Link
              to="/contacts/new"
              state={{ from: '/contacts' }}
              className="inline-flex items-center justify-center w-full sm:w-auto px-5 py-3 rounded-xl text-[15px] font-[500] text-white bg-primary-500 hover:bg-primary-600 shadow-soft hover:shadow-lg active:scale-[0.98] transition-all duration-200"
            >
              <UserPlusIcon className="h-5 w-5 mr-2" />
              Add Contact
            </Link>
          </div>
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
          {!isPremium && !isOnTrial && totalCount > 15 && (
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
          <VirtualizedContactList
            contacts={contacts}
            eventsMap={eventsMap}
            isPremium={isPremium}
            isOnTrial={isOnTrial}
            onDelete={handleDeleteContact}
            onQuickInteraction={(params: QuickInteractionParams) =>
              setQuickInteraction({
                isOpen: true,
                contactId: params.contactId,
                type: params.type,
                contactName: params.contactName
              })}
            hasNextPage={hasNextPage}
            loadMore={() => fetchNextPage()}
            isLoading={isLoading}
            isContactsPage={true}
          />
        </div>
      </div>
      <BulkImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onSelect={handleImportMethod}
        isProcessing={isImporting}
      />
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
            onSuccess={() => refetch()}
          />
        </Suspense>
      )}
    </div>
  );
};

export default Contacts;