import { supabase } from '../lib/supabase/client';
import type { Contact } from '../lib/supabase/types';

/**
 * Service to manage visibility of contacts for free users.
 * This is the single source of truth for which contacts are visible to free users.
 */
export const freeContactsService = {
  /**
   * Get the 15 most recent contacts that are visible to free users.
   * This is the core method that defines which contacts a free user can see.
   * Used by other services to ensure consistent contact visibility.
   */
  async getVisibleContactIds(): Promise<string[]> {
    const { data: contacts } = await supabase
      .from('contacts')
      .select('id')
      .order('created_at', { ascending: false })  // Most recent first
      .order('name', { ascending: true })         // Then by name for stable sorting
      .limit(15);

    return (contacts || []).map(c => c.id);
  },

  /**
   * Get the full details of the 15 most recent contacts.
   * Similar to getVisibleContactIds but returns complete contact data.
   */
  async getVisibleContacts(): Promise<Contact[]> {
    const { data: contacts } = await supabase
      .from('contacts')
      .select(`
        id,
        user_id,
        name,
        phone,
        social_media_platform,
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
      .order('created_at', { ascending: false })  // Most recent first
      .order('name', { ascending: true })         // Then by name for stable sorting
      .limit(15);

    return contacts || [];
  },

  /**
   * Get a subset of the most recent contacts, used by dashboard widgets.
   * @param limit Number of recent contacts to return (must be ≤ 15)
   */
  async getRecentContacts(limit: number): Promise<Contact[]> {
    if (limit > 15) {
      throw new Error('Cannot request more than 15 contacts for free users');
    }

    const contacts = await this.getVisibleContacts();
    return contacts.slice(0, limit);
  },

  /**
   * Check if a specific contact is visible to a free user
   */
  async isContactVisible(contactId: string): Promise<boolean> {
    const visibleIds = await this.getVisibleContactIds();
    return visibleIds.includes(contactId);
  },

  /**
   * Filter a list of contact IDs to only those visible to free users
   */
  async filterVisibleContactIds(contactIds: string[]): Promise<string[]> {
    const visibleIds = await this.getVisibleContactIds();
    const visibleSet = new Set(visibleIds);
    return contactIds.filter(id => visibleSet.has(id));
  }
};