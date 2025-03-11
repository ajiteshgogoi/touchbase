import { useInfiniteQuery, InfiniteData } from '@tanstack/react-query';
import { useCallback } from 'react';
import { Contact } from '../lib/supabase/types';
import { supabase } from '../lib/supabase/client';
import { useStore } from '../stores/useStore';

export const PAGE_SIZE = 20;

interface PaginatedContacts {
  contacts: Contact[];
  nextCursor: string | null;
  hasMore: boolean;
}

interface UseContactsPaginationProps {
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  searchQuery?: string;
  selectedCategories?: string[];
}

export function useContactsPagination({
  sortBy = 'created_at',
  sortOrder = 'desc',
  searchQuery = '',
  selectedCategories = []
}: UseContactsPaginationProps = {}) {
  const { isPremium, isOnTrial } = useStore();

  const fetchContactsPage = useCallback(async (
    cursor?: string | null,
    pageSize: number = PAGE_SIZE
  ): Promise<PaginatedContacts> => {
    // For free tier, always return first 15 contacts
    if (!isPremium && !isOnTrial) {
      const { data, error } = await supabase
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
        `)
        .order('created_at', { ascending: false })
        .limit(15);

      if (error) throw error;
      return {
        contacts: data || [],
        nextCursor: null,
        hasMore: false
      };
    }

    // For premium users, implement cursor-based pagination
    let query = supabase
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
      query = query.or(`name.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%,social_media_handle.ilike.%${searchQuery}%`);
    }

    // Add sorting
    query = query.order(sortBy, { ascending: sortOrder === 'asc' });

    // Add cursor pagination
    if (cursor) {
      query = query.gt('id', cursor);
    }

    // Get one extra item to determine if there are more pages
    query = query.limit(pageSize + 1);

    const { data, error } = await query;
    if (error) throw error;

    // Ensure data is an array and handle pagination
    const items = data || [];
    const contacts = items.slice(0, pageSize);
    const hasMore = items.length > pageSize;
    
    // Get next cursor from last contact if we have more pages
    const lastContact = contacts[contacts.length - 1];
    const nextCursor = hasMore && lastContact
      ? lastContact.id
      : null;

    return {
      contacts,
      nextCursor,
      hasMore
    };
  }, [isPremium, isOnTrial, sortBy, sortOrder, searchQuery]);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    status,
    error
  } = useInfiniteQuery<PaginatedContacts, Error, InfiniteData<PaginatedContacts>, (string | string[])[], string | null>({
    queryKey: ['contacts', sortBy, sortOrder, searchQuery, selectedCategories],
    queryFn: async ({ pageParam }) => fetchContactsPage(pageParam as string | null),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: null as string | null,
    staleTime: 5 * 60 * 1000 // Cache for 5 minutes
  });

  // Flatten all pages into a single contacts array
  const contacts = data?.pages.flatMap((page: PaginatedContacts) => page.contacts) ?? [];

  // Filter by categories if needed (client-side for now)
  const filteredContacts = selectedCategories.length > 0
    ? contacts.filter((contact: Contact) => {
        const contactCategories = (contact.notes || '')
          .split(' ')
          .filter((word: string) => word.startsWith('#'))
          .map((tag: string) => tag.slice(1).toLowerCase());
        return selectedCategories.every(category =>
          contactCategories.includes(category.toLowerCase())
        );
      })
    : contacts;

  return {
    contacts: filteredContacts,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    status,
    error
  };
}