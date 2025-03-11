import { useInfiniteQuery, InfiniteData } from '@tanstack/react-query';
import { PostgrestFilterBuilder } from '@supabase/postgrest-js';
import { Contact } from '../lib/supabase/types';
import { supabase } from '../lib/supabase/client';
import { useStore } from '../stores/useStore';

const PAGE_SIZE = 20;

interface ContactsQueryOptions {
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  searchQuery?: string;
  selectedCategories?: string[];
}

interface PaginatedContacts {
  contacts: Contact[];
  nextCursor: string | null;
  hasMore: boolean;
}

export function useContactsQuery({
  sortBy = 'created_at',
  sortOrder = 'desc',
  searchQuery = '',
  selectedCategories = []
}: ContactsQueryOptions = {}) {
  const { isPremium, isOnTrial } = useStore();

  const buildContactsQuery = (cursor?: string | null) => {
    let query: PostgrestFilterBuilder<any, any, any> = supabase
      .from('contacts')
      .select(`
        id,
        user_id,
        name,
        phone,
        social_media_handle,
        last_contacted,
        next_contact_due,
        preferred_contact_method,
        notes,
        contact_frequency,
        ai_last_suggestion,
        ai_last_suggestion_date,
        missed_interactions,
        created_at,
        updated_at,
        important_events (
          id,
          type,
          name,
          date
        )
      `);

    // Apply search filter if provided
    if (searchQuery) {
      query = query.or(
        `name.ilike.%${searchQuery}%,` +
        `phone.ilike.%${searchQuery}%,` +
        `social_media_handle.ilike.%${searchQuery}%`
      );
    }

    // Apply hashtag filtering using Postgres text pattern matching
    if (selectedCategories.length > 0) {
      // Build an OR condition for the hashtags
      const hashtagConditions = selectedCategories.map(category => {
        const hashtag = category.startsWith('#') ? category : `#${category}`;
        return `notes.ilike.%${hashtag}%`;
      });
      query = query.or(hashtagConditions.join(','));
    }

    // For free tier users, always return first 15 contacts
    if (!isPremium && !isOnTrial) {
      query = query
        .order('created_at', { ascending: false })
        .limit(15);

      return query;
    }

    // Add sorting
    query = query.order(sortBy, { ascending: sortOrder === 'asc' });

    // Add cursor pagination
    if (cursor) {
      query = query.gt('id', cursor);
    }

    // Get one extra item to determine if there are more pages
    return query.limit(PAGE_SIZE + 1);
  };

  const fetchContactsPage = async (cursor?: string | null): Promise<PaginatedContacts> => {
    const query = buildContactsQuery(cursor);
    const { data: items = [], error } = await query;
    
    if (error) throw error;

    if (!isPremium && !isOnTrial) {
      return {
        contacts: items,
        nextCursor: null,
        hasMore: false
      };
    }

    const contacts = items.slice(0, PAGE_SIZE);
    const hasMore = items.length > PAGE_SIZE;
    const lastContact = contacts[contacts.length - 1];
    const nextCursor = hasMore && lastContact ? lastContact.id : null;

    return {
      contacts,
      nextCursor,
      hasMore
    };
  };

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    status,
    error
  } = useInfiniteQuery<PaginatedContacts, Error, InfiniteData<PaginatedContacts>, (string | string[])[], string | null>({
    queryKey: ['contacts', sortBy, sortOrder, searchQuery, selectedCategories],
    queryFn: ({ pageParam }) => fetchContactsPage(pageParam as string | null),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: null as string | null,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    structuralSharing: false,
    gcTime: 24 * 60 * 60 * 1000 // Keep cache for 24 hours
  });

  // Flatten all pages into a single contacts array
  const contacts = data?.pages.flatMap((page: PaginatedContacts) => page.contacts) ?? [];

  return {
    contacts,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    status,
    error
  };
}