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
        social_media_platform,
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
        next_contact_due,
        preferred_contact_method
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

    if (!isPremium && !isOnTrial) {
      // For free users:
      // 1. First sort by created_at to get most recent
      // 2. Limit to 15 most recent
      // 3. Then order those 15 by user's preferred sort
      const { data: recentContacts } = await supabase
        .from('contacts')
        .select(`
          id,
          name,
          last_contacted,
          missed_interactions,
          contact_frequency,
          next_contact_due,
          preferred_contact_method
        `)
        .order('created_at', { ascending: false })
        .limit(15);

      // Apply search filter if needed
      let filteredContacts = recentContacts || [];
      if (filters.search) {
        // Remove parentheses from both search term and contact name for comparison
        const cleanSearch = filters.search!.toLowerCase().replace(/[()]/g, '');
        filteredContacts = filteredContacts.filter(contact => {
          const cleanName = contact.name.toLowerCase().replace(/[()]/g, '');
          return cleanName.includes(cleanSearch);
        });
      }

      // Apply category filters if needed
      if (filters.categories && filters.categories.length > 0) {
        // Note: We'd need to fetch notes for this filtering
        // This might need optimization in a real implementation
      }

      // Apply user's preferred sorting
      filteredContacts.sort((a, b) => {
        // Primary sort based on selected field
        let comparison = 0;
        if (sort.field === 'name') {
          comparison = sort.order === 'asc'
            ? a.name.localeCompare(b.name)
            : b.name.localeCompare(a.name);
        } else if (sort.field === 'last_contacted') {
          const aDate = a.last_contacted ? new Date(a.last_contacted).getTime() : 0;
          const bDate = b.last_contacted ? new Date(b.last_contacted).getTime() : 0;
          comparison = sort.order === 'asc' ? aDate - bDate : bDate - aDate;
        } else { // missed_interactions
          comparison = sort.order === 'asc'
            ? (a.missed_interactions || 0) - (b.missed_interactions || 0)
            : (b.missed_interactions || 0) - (a.missed_interactions || 0);
        }

        // If primary sort results in a tie, sort alphabetically by name
        if (comparison === 0 && sort.field !== 'name') {
          return a.name.localeCompare(b.name);
        }

        return comparison;
      });

      return {
        contacts: filteredContacts.slice(offset, offset + PAGE_SIZE),
        hasMore: offset + PAGE_SIZE < filteredContacts.length,
        total: recentContacts?.length || 0
      };
    } else {
      // Premium users: Apply sorting with name as secondary sort
      query = query
        .order(sort.field, { ascending: sort.order === 'asc' })
        .order('name', { ascending: true }); // Always sort alphabetically by name as secondary sort
      query = query.range(offset, offset + PAGE_SIZE - 1);
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