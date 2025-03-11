import { supabase } from '../lib/supabase/client';
import type { Contact } from '../lib/supabase/types';
import { paymentService } from './payment';

const PAGE_SIZE = 20;

export type SortConfig = {
  field: 'name' | 'last_contacted' | 'missed_interactions';
  order: 'asc' | 'desc';
};

export type FilterConfig = {
  search?: string;
  categories?: string[];
};

export const contactsPaginationService = {
  async getUniqueHashtags(): Promise<string[]> {
    const { data, error } = await supabase
      .from('contacts')
      .select('notes')
      .not('notes', 'is', null);

    if (error) throw error;
    
    // Extract and deduplicate hashtags on server side
    const hashtagSet = new Set<string>();
    data?.forEach(contact => {
      const matches = (contact.notes || '').match(/#[a-zA-Z0-9_]+/g) || [];
      matches.forEach((tag: string) => hashtagSet.add(tag.toLowerCase()));
    });

    return Array.from(hashtagSet);
  },

  async getFilteredContacts(
    page: number,
    sort: SortConfig,
    filters: FilterConfig
  ): Promise<{ contacts: Contact[]; hasMore: boolean; total: number }> {
    const { isPremium, isOnTrial } = await paymentService.getSubscriptionStatus();
    const offset = page * PAGE_SIZE;

    // Start building the query
    let query = supabase
      .from('contacts')
      .select('*', { count: 'exact' });

    // Apply search filter if provided
    if (filters.search) {
      query = query.or(`name.ilike.%${filters.search}%,phone.ilike.%${filters.search}%,social_media_handle.ilike.%${filters.search}%`);
    }

    // Apply category filters if provided
    // Match any of the selected categories (OR condition)
    if (filters.categories && filters.categories.length > 0) {
      const categoryConditions = filters.categories
        .map(category => {
          // Ensure hashtag has # prefix and is lowercase to match storage format
          const hashtagQuery = category.startsWith('#') ? category : `#${category}`;
          return `notes.ilike.%${hashtagQuery.toLowerCase()}%`;
        })
        .join(',');
      query = query.or(categoryConditions);
    }

    // Apply sorting
    query = query.order(sort.field, { ascending: sort.order === 'asc' });

    // Add pagination
    query = query
      .range(offset, offset + PAGE_SIZE - 1);

    // For free users, ensure we don't exceed 15 contacts
    if (!isPremium && !isOnTrial) {
      query = query.limit(Math.min(PAGE_SIZE, 15 - offset));
    }

    const { data, error, count } = await query;
    
    if (error) throw error;

    // Calculate if there are more results
    const total = count || 0;
    const hasMore = offset + PAGE_SIZE < total && (isPremium || isOnTrial || offset + PAGE_SIZE < 15);

    return {
      contacts: data || [],
      hasMore,
      total
    };
  }
};