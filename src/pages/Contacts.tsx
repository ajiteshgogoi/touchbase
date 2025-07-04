import { useState, lazy, Suspense, useMemo, useEffect } from 'react';
import { useDebounce } from '../hooks/useDebounce';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { contactsService } from '../services/contacts';
import { supabase } from '../lib/supabase/client';
import { contactsPaginationService } from '../services/pagination';
import { useStore } from '../stores/useStore';
import { VirtualizedContactList } from '../components/contacts/VirtualizedContactList';
import {
  UserPlusIcon,
  MagnifyingGlassIcon,
  ChevronUpDownIcon,
  ArrowLeftIcon,
  UsersIcon,
  TrashIcon,
  CheckCircleIcon,
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
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [sortField, setSortField] = useState<SortField>('name');

  // Update URL when search query changes
  useEffect(() => {
    const newSearchParams = new URLSearchParams(location.search);
    if (debouncedSearchQuery) {
      newSearchParams.set('search', debouncedSearchQuery);
    } else {
      newSearchParams.delete('search');
    }
    navigate(`${location.pathname}?${newSearchParams.toString()}`, { replace: true });
  }, [debouncedSearchQuery, location.pathname, navigate]);

  // Sync with URL search param changes
  useEffect(() => {
    const searchFromUrl = searchParams.get('search') || '';
    if (searchFromUrl !== searchQuery) {
      setSearchQuery(searchFromUrl);
    }
  }, [location.search]);
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [quickInteraction, setQuickInteraction] = useState<{
    isOpen: boolean;
    contactId: string;
    type: Interaction['type'];
    contactName: string;
  } | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  const { isPremium, isOnTrial } = useStore();

  // Handle bulk delete
  const handleBulkDelete = async () => {
    if (!selectedContacts.size) return;
    
    if (confirm(`Are you sure you want to delete ${selectedContacts.size} contacts?`)) {
      try {
        setIsBulkDeleting(true);
        await contactsService.bulkDeleteContacts(Array.from(selectedContacts));
        setSelectedContacts(new Set());
        setIsSelectionMode(false);
        await refetch();
      } catch (error) {
        console.error('Error bulk deleting contacts:', error);
        alert('Failed to delete contacts. Please try again.');
      } finally {
        setIsBulkDeleting(false);
      }
    }
  };

  // Handle selection toggle for a contact
  const handleToggleSelect = (contactId: string) => {
    if (isBulkDeleting) return;
    
    setSelectedContacts(prev => {
      const next = new Set(prev);
      if (next.has(contactId)) {
        next.delete(contactId);
      } else {
        next.add(contactId);
      }
      return next;
    });
  };
  // Handle select all
  const handleSelectAll = async () => {
    try {
      if (selectedContacts.size === filteredCount) {
        setSelectedContacts(new Set());
      } else {
        const allContactIds = new Set<string>();
        let page = 0;
        const pageSize = 950; // Process in chunks of 950
        
        while (true) {
          // Get contact IDs in chunks 
          let query = supabase
            .from('contacts')
            .select('id')
            .range(page * pageSize, (page + 1) * pageSize - 1);
          
          if (debouncedSearchQuery) {
            query = query.or(`name.ilike.%${debouncedSearchQuery}%,email.ilike.%${debouncedSearchQuery}%,phone.ilike.%${debouncedSearchQuery}%,social_media_handle.ilike.%${debouncedSearchQuery}%`);
          }

          if (selectedCategories.length > 0) {
            const categoryConditions = selectedCategories
              .map(category => {
                const hashtagQuery = category.startsWith('#') ? category : `#${category}`;
                return `notes.ilike.%${hashtagQuery.toLowerCase()}%`;
              })
              .join(',');
            query = query.or(categoryConditions);
          }

          // Apply sorting to maintain consistency with current view
          query = query.order(sortField, { ascending: sortOrder === 'asc' });

          const { data, error } = await query;
          if (error) throw error;

          // If no more data, break the loop
          if (!data || data.length === 0) break;

          // Add IDs to the set
          data.forEach(contact => allContactIds.add(contact.id));

          // If we got less than pageSize results, we've reached the end
          if (data.length < pageSize) break;

          page++;
        }

        setSelectedContacts(allContactIds);
      }
    } catch (error) {
      console.error('Error selecting all contacts:', error);
      alert('Failed to select all contacts. Please try again.');
    }
  };

  // Start selection mode
  const handleStartSelectionMode = () => {
    if (!isBulkDeleting) {
      setIsSelectionMode(true);
    }
  };

  // Exit selection mode
  const handleExitSelectionMode = () => {
    if (!isBulkDeleting) {
      setIsSelectionMode(false);
      setSelectedContacts(new Set());
    }
  };

  // Handle document-level clicks
  useEffect(() => {
    const handleDocumentClick = (e: MouseEvent) => {
      if (!isSelectionMode) return;

      const target = e.target as HTMLElement;
      // For debugging
      console.log('Click target classes:', target.className);
      console.log('Parent elements:', Array.from(target.closest('div')?.classList || []));

      // Check if click is on scrollbar
      const isScrollbarClick = (e: MouseEvent) => {        
        // Check for virtualized list scrollbar first (keep existing working logic)
        const scrollContainer = target.closest('[data-virtualized-list]') ||
                              target.closest('div[style*="overflow"]') ||
                              document.querySelector('[role="grid"]');
        
        if (scrollContainer) {
          const rect = scrollContainer.getBoundingClientRect();
          const isContainerScrollbar = (
            (e.clientX > rect.right - 20 && e.clientX <= rect.right) ||
            (e.clientY > rect.bottom - 20 && e.clientY <= rect.bottom)
          );
          if (isContainerScrollbar) return true;
        }
        
        // New approach: Check if click is directly on document/body
        // This typically indicates a scrollbar click
        if (target === document.documentElement || target === document.body) {
          // Additional verification using coordinates
          const windowWidth = document.documentElement.clientWidth;
          const windowHeight = document.documentElement.clientHeight;
          const isMainScrollbarVertical = e.clientX > windowWidth - 20;
          const isMainScrollbarHorizontal = e.clientY > windowHeight - 20;
          
          return isMainScrollbarVertical || isMainScrollbarHorizontal;
        }
        
        return false;
      };

      const isInteractive =
        target.tagName === 'BUTTON' ||
        target.tagName === 'INPUT' ||
        target.tagName === 'SELECT' ||
        target.tagName === 'A' ||
        target.closest('.react-window-list') ||
        target.closest('[style*="padding: 8px"]') ||
        target.closest('[role="button"]') ||
        target.classList.contains('bg-gradient-to-r') ||
        target.closest('button') ||
        target.closest('a') ||
        isScrollbarClick(e);

      if (!isInteractive && !isBulkDeleting) {
        handleExitSelectionMode();
      }
    };

    document.addEventListener('mousedown', handleDocumentClick);
    return () => document.removeEventListener('mousedown', handleDocumentClick);
  }, [isSelectionMode, isBulkDeleting]);

  const handleImportMethod = async (method: 'google' | 'csv_upload' | 'csv_template' | 'vcf_upload') => {
    if (method === 'csv_template') {
      const response = await fetch('/contacts_template.csv');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'contacts_template.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      return;
    }

    if (method === 'google') {
      // TODO: Implement Google Contacts import in the future
      return;
    }

    // Keep modal open for CSV upload, the BulkImportModal component
    // now handles the upload process internally
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
  // Get filtered count for display
  const filteredCount = contactsData?.pages?.[0]?.total || 0;

  // Get total contacts count (unfiltered) for limit checking
  const { data: totalContacts, isLoading: isLoadingTotal } = useQuery({
    queryKey: ['total-contacts'],
    queryFn: async () => {
      const { count } = await supabase
        .from('contacts')
        .select('*', { count: 'exact', head: true });
      return count || 0;
    },
    staleTime: 5 * 60 * 1000
  });

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
  // Only allow adding contacts once we're sure about the total count
  const canAddMore = !isLoadingTotal && (totalContacts || 0) < contactLimit;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-4">
            {isSelectionMode ? (
              <button
                onClick={handleExitSelectionMode}
                disabled={isBulkDeleting}
                className={`p-2.5 -m-2.5 text-gray-400 rounded-xl transition-all duration-200 ${
                  isBulkDeleting ? 'opacity-50 cursor-not-allowed' : 'hover:text-primary-500 hover:bg-gray-50/70 dark:hover:bg-gray-800/70'
                }`}
                aria-label={isBulkDeleting ? "Cannot exit while deleting" : "Exit selection mode"}
              >
                <ArrowLeftIcon className="h-5 w-5" />
              </button>
            ) : (
              <button
                onClick={() => navigate(-1)}
                className="p-2.5 -m-2.5 text-gray-400 dark:text-gray-500 hover:text-primary-500 dark:hover:text-primary-400 hover:bg-gray-50/10 dark:hover:bg-gray-900/10 rounded-xl transition-all duration-200"
                aria-label="Go back"
              >
                <ArrowLeftIcon className="h-5 w-5" />
              </button>
            )}
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-primary-600 to-primary-400 bg-clip-text text-transparent">
                {isSelectionMode ? `${selectedContacts.size} Selected` : 'Contacts'}
              </h1>
              <p className="mt-1.5 text-[15px] text-gray-600/90 dark:text-gray-400">
                {isSelectionMode 
                  ? 'Select contacts to delete in bulk'
                  : 'Keep your relationships intentional with a focused contact list'
                }
              </p>
            </div>
          </div>
        </div>
        {isSelectionMode ? (
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleSelectAll}
              disabled={isBulkDeleting}
              className="inline-flex items-center justify-center w-full sm:w-auto px-5 py-3 rounded-xl text-[15px] font-[500] text-primary-600 dark:text-primary-400 bg-primary-50/90 dark:bg-primary-900/30 hover:bg-primary-100/90 dark:hover:bg-primary-900/50 disabled:text-gray-400 dark:disabled:text-gray-600 disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:cursor-not-allowed shadow-soft dark:shadow-soft-dark hover:shadow-lg active:scale-[0.98] transition-all duration-200"
            >
              <CheckCircleIcon className="h-5 w-5 mr-2" />
              {selectedContacts.size === filteredCount ? 'Deselect All' : 'Select All'}
            </button>
            <button
              onClick={handleBulkDelete}
              disabled={selectedContacts.size === 0 || isBulkDeleting}
              className="inline-flex items-center justify-center w-full sm:w-auto px-5 py-3 rounded-xl text-[15px] font-[500] text-white bg-red-500 hover:bg-red-600 disabled:bg-gray-300 disabled:cursor-not-allowed shadow-soft hover:shadow-lg active:scale-[0.98] transition-all duration-200"
            >
              <TrashIcon className="h-5 w-5 mr-2" />
              {isBulkDeleting ? 'Deleting...' : 'Delete Selected'}
            </button>
          </div>
        ) : (
          !isPremium && !isOnTrial ? (
            // Show disabled buttons while loading for free users
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => setShowImportModal(true)}
                disabled={isLoadingTotal || !canAddMore}
                className="inline-flex items-center justify-center w-full sm:w-auto px-5 py-3 rounded-xl text-[15px] font-[500] text-primary-600 dark:text-primary-400 bg-primary-50/90 dark:bg-primary-900/30 hover:bg-primary-100/90 dark:hover:bg-primary-900/50 disabled:text-gray-400 dark:disabled:text-gray-600 disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:cursor-not-allowed shadow-soft dark:shadow-soft-dark hover:shadow-lg active:scale-[0.98] transition-all duration-200"
              >
                <UsersIcon className="h-5 w-5 mr-2" />
                Bulk Import
              </button>
              <Link
                to={canAddMore ? "/contacts/new" : "/settings"}
                state={{ from: '/contacts' }}
                className={`inline-flex items-center justify-center w-full sm:w-auto px-5 py-3 rounded-xl text-[15px] font-[500] ${
                  isLoadingTotal ? 'text-gray-400 bg-gray-100 dark:text-gray-600 dark:bg-gray-800 cursor-not-allowed' :
                  canAddMore ? 'text-white bg-primary-500 dark:bg-primary-600 hover:bg-primary-600 dark:hover:bg-primary-700' :
                  'text-white bg-gray-400 dark:bg-gray-600 hover:bg-gray-500 dark:hover:bg-gray-700'
                } shadow-soft dark:shadow-soft-dark hover:shadow-lg active:scale-[0.98] transition-all duration-200`}
              >
                <span className="min-w-[130px] inline-flex items-center justify-center">
                  <span className="min-w-[130px] inline-flex items-center justify-center">
                    {isLoadingTotal ? (
                      <span className="text-center">Loading...</span>
                    ) : canAddMore ? (
                      <span className="inline-flex items-center">
                        <UserPlusIcon className="h-5 w-5 mr-2" />
                        Add Contact
                      </span>
                    ) : (
                      <span className="text-center">Upgrade to add more contacts</span>
                    )}
                  </span>
                </span>
              </Link>
            </div>
          ) : canAddMore ? (
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => setShowImportModal(true)}
                className="inline-flex items-center justify-center w-full sm:w-auto px-5 py-3 rounded-xl text-[15px] font-[500] text-primary-600 dark:text-primary-400 bg-primary-50/90 dark:bg-primary-900/30 hover:bg-primary-100/90 dark:hover:bg-primary-900/50 shadow-soft dark:shadow-soft-dark hover:shadow-lg active:scale-[0.98] transition-all duration-200"
              >
                <UsersIcon className="h-5 w-5 mr-2" />
                Bulk Import
              </button>
              <Link
                to="/contacts/new"
                state={{ from: '/contacts' }}
                className="inline-flex items-center justify-center w-full sm:w-auto px-5 py-3 rounded-xl text-[15px] font-[500] text-white bg-primary-500 dark:bg-primary-600 hover:bg-primary-600 dark:hover:bg-primary-700 shadow-soft dark:shadow-soft-dark hover:shadow-lg active:scale-[0.98] transition-all duration-200"
              >
                <UserPlusIcon className="h-5 w-5 mr-2" />
                Add Contact
              </Link>
            </div>
          ) : (
            // Premium users always see enabled buttons
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => setShowImportModal(true)}
                className="inline-flex items-center justify-center w-full sm:w-auto px-5 py-3 rounded-xl text-[15px] font-[500] text-primary-600 dark:text-primary-400 bg-primary-50/90 dark:bg-primary-900/30 hover:bg-primary-100/90 dark:hover:bg-primary-900/50 shadow-soft dark:shadow-soft-dark hover:shadow-lg active:scale-[0.98] transition-all duration-200"
              >
                <UsersIcon className="h-5 w-5 mr-2" />
                Bulk Import
              </button>
              <Link
                to="/contacts/new"
                state={{ from: '/contacts' }}
                className="inline-flex items-center justify-center w-full sm:w-auto px-5 py-3 rounded-xl text-[15px] font-[500] text-white bg-primary-500 dark:bg-primary-600 hover:bg-primary-600 dark:hover:bg-primary-700 shadow-soft dark:shadow-soft-dark hover:shadow-lg active:scale-[0.98] transition-all duration-200"
              >
                <UserPlusIcon className="h-5 w-5 mr-2" />
                Add Contact
              </Link>
            </div>
          )
        )}
      </div>

      <div className="bg-white/60 dark:bg-gray-900/60 backdrop-blur-xl rounded-xl border border-gray-100/50 dark:border-gray-800/50 shadow-soft dark:shadow-soft-dark">
        <div className="p-6 border-b border-gray-100 dark:border-gray-800">
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
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 focus:outline-none focus:border-primary-400 dark:focus:border-primary-500 focus:ring-1 focus:ring-primary-400 dark:focus:ring-primary-500 hover:border-gray-300 dark:hover:border-gray-600 transition-colors bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2 sm:w-auto">
                <div className="flex-1">
                  <select
                    value={sortField}
                    onChange={(e) => setSortField(e.target.value as SortField)}
                    className="w-full pl-4 pr-10 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 focus:outline-none focus:border-primary-400 dark:focus:border-primary-500 focus:ring-1 focus:ring-primary-400 dark:focus:ring-primary-500 hover:border-gray-300 dark:hover:border-gray-600 transition-colors appearance-none bg-white/60 dark:bg-gray-800 backdrop-blur-sm text-sm text-gray-900 dark:text-white"
                    aria-label="Sort contacts by"
                  >
                    <option value="name">Sort by Name</option>
                    <option value="last_contacted">Sort by Last Contacted</option>
                    <option value="missed_interactions">Sort by Missed Interactions</option>
                  </select>
                </div>
                <button
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                  className="flex-shrink-0 p-2.5 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 focus:outline-none focus:border-primary-400 dark:focus:border-primary-500 focus:ring-1 focus:ring-primary-400 dark:focus:ring-primary-500 transition-colors"
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
                        ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 border-primary-200 dark:border-primary-800 shadow-sm'
                        : 'bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm text-gray-600 dark:text-gray-400 hover:bg-white/70 dark:hover:bg-gray-700/70 border-gray-200 dark:border-gray-700'
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
          {!contacts.length ? (
            <div className="p-12 text-center">
              <p className="text-[15px] text-gray-600/90 dark:text-gray-400">No contacts added yet</p>
            </div>
          ) : (
            <>
              {!isPremium && !isOnTrial && (totalContacts || 0) > 15 && (
                <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg mb-4">
                  <p className="text-sm text-amber-800 dark:text-amber-300">
                    You're seeing your 15 most recent contacts. {' '}
                    <Link to="/settings" className="font-medium text-amber-900 dark:text-amber-200 underline hover:no-underline">
                      Upgrade to Premium
                    </Link>{' '}
                    to manage all {totalContacts} of your contacts.
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
                selectedContacts={selectedContacts}
                isSelectionMode={isSelectionMode}
                onToggleSelect={handleToggleSelect}
                onStartSelectionMode={handleStartSelectionMode}
                isBulkDeleting={isBulkDeleting}
              />
            </>
          )}
        </div>
      </div>
      <BulkImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onSelect={handleImportMethod}
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
