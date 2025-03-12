import { supabase } from '../lib/supabase/client';
import type { BasicContact, Contact } from '../lib/supabase/types';
import { paymentService } from './payment';
import { contactCacheService } from './contact-cache';

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
  async getExpandedContactDetails(contactId: string): Promise<Contact | null> {
    // Check cache first
    const cached = contactCacheService.get(contactId);
    if (cached) {
      return cached as Contact;
    }

    const { data, error } = await supabase
      .from('contacts')
      .select(`
        id,
        user_id,
        phone,
        social_media_handle,
        preferred_contact_method,
        notes,
        ai_last_suggestion,
        ai_last_suggestion_date,
        created_at,
        updated_at
      `)
      .eq('id', contactId)
      .single();

    if (error) {
      console.error('Error fetching expanded contact details:', error);
      return null;
    }

    // Cache the result before returning
    if (data) {
      contactCacheService.set(contactId, data);
    }

    return data as Contact;
  },

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
  ): Promise<{ contacts: BasicContact[]; hasMore: boolean; total: number }> {
    const { isPremium, isOnTrial } = await paymentService.getSubscriptionStatus();
    const offset = page * PAGE_SIZE;

    // Start building the query
    // Only select essential fields for the initial view
    let query = supabase
      .from('contacts')
      .select(`
        id,
        name,
        last_contacted,
        missed_interactions,
        contact_frequency,
        next_contact_due
      `, { count: 'exact' });

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