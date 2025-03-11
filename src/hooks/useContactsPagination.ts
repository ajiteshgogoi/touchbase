import { useInfiniteQuery, InfiniteData } from '@tanstack/react-query';
import { useCallback } from 'react';
import { Contact } from '../lib/supabase/types';
import { supabase } from '../lib/supabase/client';
import { useStore } from '../stores/useStore';
import { extractHashtags } from '../components/contacts/utils';

export const PAGE_SIZE = 20;

interface PaginatedContacts {
  contacts: Contact[];
  nextCursor: string | null;
  hasMore: boolean;
}

type SortableFields = 'name' | 'last_contacted' | 'missed_interactions' | 'created_at';

interface UseContactsPaginationProps {
  sortBy?: SortableFields;
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

    // Add cursor pagination using the correct sort field
    if (cursor) {
      const [value, id] = cursor.split('::');
      if (value && id) {
        // For null/empty values, use appropriate SQL comparison
        if (value === 'null' || value === '') {
          query = query.or(`${sortBy}.is.not.null,and(${sortBy}.is.null,id.gt.${id})`);
        } else {
          // Escape single quotes in the value
          const escapedValue = value.replace(/'/g, "''");
          query = query
            .or(`${sortBy}.gt.${escapedValue},and(${sortBy}.eq.${escapedValue},id.gt.${id})`);
        }
      }
    }

    // Get one extra item to determine if there are more pages
    query = query.limit(pageSize + 1);

    const { data, error } = await query;
    if (error) throw error;

    // Ensure data is an array and handle pagination
    const items = data || [];
    const contacts = items.slice(0, pageSize);
    const hasMore = items.length > pageSize;
    
    // Create cursor with both sort value and id for consistent pagination
    const lastContact = contacts[contacts.length - 1];
    const nextCursor = hasMore && lastContact
      ? `${lastContact[sortBy as keyof Contact] ?? ''}::${lastContact.id}`
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
        const contactTags = extractHashtags(contact.notes || '');
        const normalizedContactTags = contactTags.map(tag => tag.slice(1).toLowerCase());
        const normalizedCategories = selectedCategories.map(category =>
          category.startsWith('#') ? category.slice(1).toLowerCase() : category.toLowerCase()
        );
        return normalizedCategories.every(category =>
          normalizedContactTags.includes(category)
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