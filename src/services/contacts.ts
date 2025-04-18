import { supabase } from '../lib/supabase/client';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import type { Contact, Interaction, Reminder, ImportantEvent, QuickReminderInput } from '../lib/supabase/types';
import { getQueryClient } from '../utils/queryClient';
import { useStore } from '../stores/useStore';
import { calculateNextContactDate, ContactFrequency } from '../utils/date';
import { contactCacheService } from './contact-cache';
import { freeContactsService } from './free-contacts';

// Extend dayjs with the relativeTime plugin
dayjs.extend(relativeTime);

// Format the next contact due date in a user-friendly way
const formatDueDate = (dueDate: string | null): string => {
  if (!dueDate) return 'Not set';
  
  const due = dayjs(dueDate);
  const today = dayjs();
  
  if (due.isSame(today, 'day')) return 'Today';
  if (due.isSame(today.add(1, 'day'), 'day')) return 'Tomorrow';
  return due.fromNow();
};

export const contactsService = {
  formatDueDate,

  async getRecentContacts(): Promise<Contact[]> {
    const { isPremium, isOnTrial } = useStore.getState();
    
    if (!isPremium && !isOnTrial) {
      // For free users, get 3 contacts from their visible 15
      return freeContactsService.getRecentContacts(3);
    }

    // Premium users can see all contacts
    const { data, error } = await supabase
      .from('contacts')
      .select(`
        id,
        user_id,
        name,
        email,
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
      .order('created_at', { ascending: false })
      .order('name', { ascending: true })
      .limit(3);

    if (error) throw error;
    return data || [];
  },

  async getContacts(): Promise<Contact[]> {
    const { isPremium, isOnTrial } = useStore.getState();

    if (!isPremium && !isOnTrial) {
      return freeContactsService.getVisibleContacts();
    }

    // Premium users see all contacts
    const { data, error } = await supabase
      .from('contacts')
      .select(`
        id,
        user_id,
        name,
        email,
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
      .order('created_at', { ascending: false })
      .order('name', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  async getContactWithEvents(id: string): Promise<{contact: Contact | null, events: ImportantEvent[]}> {
    const { data, error } = await supabase
      .from('contacts')
      .select(`
        id,
        user_id,
        name,
        email,
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
          contact_id,
          user_id,
          type,
          name,
          date,
          created_at,
          updated_at
        )
      `)
      .eq('id', id)
      .single();
    
    if (error) throw error;
    
    return {
      contact: data,
      events: data?.important_events || []
    };
  },

  async getContact(id: string): Promise<Contact | null> {
    const { data, error } = await supabase
      .from('contacts')
      .select(`
        id,
        user_id,
        name,
        email,
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
        updated_at
      `)
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data;
  },

  async checkContactLimit(): Promise<void> {
    const { isPremium, isOnTrial } = useStore.getState();
    if (isPremium || isOnTrial) return;

    const contacts = await this.getContacts();
    if (contacts.length >= 15) {
      throw new Error('Free tier contact limit reached. Please upgrade to add more contacts.');
    }
  },

  async createContact(contact: Omit<Contact, 'id' | 'created_at' | 'updated_at'>): Promise<Contact> {
    await this.checkContactLimit();
    
    // Clear the contact cache since we're adding a new contact
    contactCacheService.clear();
    
    // Get user's timezone preference
    const { data: userPref } = await supabase
      .from('user_preferences')
      .select('timezone')
      .eq('user_id', contact.user_id)
      .single();

    // Use UTC if no timezone preference is set
    const timezone = userPref?.timezone || 'UTC';
    
    // Get current time in user's timezone
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: timezone }));

    // First create the contact to get its ID
    const { data, error } = await supabase
      .from('contacts')
      .insert({
        ...contact,
        email: contact.email || null, // Ensure email is included
        next_contact_due: now.toISOString(), // Temporary date, will be recalculated
        last_contacted: now.toISOString(), // Set initial last_contacted in user's timezone
        missed_interactions: 0
      })
      .select()
      .single();
      
    if (error) throw error;

    // After contact is created, calculate next due date considering important events
    await this.recalculateNextContactDue(data.id);
    
    // Invalidate all related caches after creating a new contact
    getQueryClient().invalidateQueries({ queryKey: ['reminders'] });
    getQueryClient().invalidateQueries({ queryKey: ['total-reminders'] });
    getQueryClient().invalidateQueries({ queryKey: ['contacts'] });
    getQueryClient().invalidateQueries({ queryKey: ['recent-contacts'] });
    getQueryClient().invalidateQueries({ queryKey: ['total-contacts'] });
    getQueryClient().invalidateQueries({ queryKey: ['important-events'] });
    getQueryClient().invalidateQueries({ queryKey: ['contact-hashtags'] });
    
    // Return updated contact with proper next_contact_due
    const updatedContact = await this.getContact(data.id);
    if (!updatedContact) throw new Error('Failed to create contact');
    return updatedContact;
  },

  /**
   * Get all important events for a contact
   * @param contactId Optional - if provided, gets events only for that contact
   * @returns Array of important events sorted by date
   */
  async getImportantEvents(contactId?: string): Promise<ImportantEvent[]> {
    if (contactId) {
      // If contactId is provided, use the original query for single contact
      const { data, error } = await supabase
        .from('important_events')
        .select(`
          id,
          contact_id,
          user_id,
          type,
          name,
          date,
          created_at,
          updated_at
        `)
        .eq('contact_id', contactId)
        .order('date');

      if (error) throw error;
      return data || [];
    }

    // Otherwise use the optimized function for upcoming events
    const { isPremium, isOnTrial } = useStore.getState();

    // For free users, get visible contact IDs
    let visibleContactIds: string[] | null = null;
    if (!isPremium && !isOnTrial) {
      visibleContactIds = await freeContactsService.getVisibleContactIds();
    }

    const { data, error } = await supabase.rpc('get_upcoming_events', {
      p_user_id: (await supabase.auth.getUser()).data.user?.id,
      p_visible_contact_ids: visibleContactIds,
      p_months_ahead: 12,
      p_limit: null
    });

    if (error) throw error;
    return data || [];
  },

  /**
   * Get upcoming events with optimized date calculations and filtering
   * @param months Number of months to look ahead (default: 12)
   * @param limit Maximum number of events to return
   * @returns Array of upcoming events sorted by next occurrence
   */
  async getUpcomingEvents(months: number = 12, limit?: number): Promise<ImportantEvent[]> {
    const { isPremium, isOnTrial } = useStore.getState();

    // For free users, get visible contact IDs
    let visibleContactIds: string[] | null = null;
    if (!isPremium && !isOnTrial) {
      visibleContactIds = await freeContactsService.getVisibleContactIds();
    }

    const { data, error } = await supabase.rpc('get_upcoming_events', {
      p_user_id: (await supabase.auth.getUser()).data.user?.id,
      p_visible_contact_ids: visibleContactIds,
      p_months_ahead: months,
      p_limit: limit
    });

    if (error) throw error;
    return data || [];
  },

  /**
   * Create a new important event for a contact
   * Enforces the maximum limit of 5 events per contact
   */
  async addImportantEvent(
    event: Omit<ImportantEvent, 'id' | 'created_at' | 'updated_at'>,
    skipRegularReminder = false
  ): Promise<ImportantEvent> {
    // Check if contact already has 5 events
    const existingEvents = await this.getImportantEvents(event.contact_id);
    if (existingEvents.length >= 5) {
      throw new Error('Maximum of 5 important events allowed per contact');
    }

    // Validate custom event has a name
    if (event.type === 'custom' && !event.name) {
      throw new Error('Custom events must have a name');
    }

    const { data, error } = await supabase
      .from('important_events')
      .insert(event)
      .select()
      .single();

    if (error) throw error;

    // Recalculate next due date since an important event might be sooner
    await this.recalculateNextContactDue(event.contact_id, skipRegularReminder);

    // Invalidate important events cache so the UI updates
    getQueryClient().invalidateQueries({ queryKey: ['important-events'] });

    return data;
  },

  /**
   * Update an important event
   */
  async updateImportantEvent(
    id: string, 
    updates: Partial<Omit<ImportantEvent, 'id' | 'created_at' | 'updated_at'>>
  ): Promise<ImportantEvent> {
    const { data, error } = await supabase
      .from('important_events')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // If date was updated, recalculate next due date
    if (updates.date) {
      await this.recalculateNextContactDue(data.contact_id);
    }

    // Invalidate important events cache so the UI updates
    getQueryClient().invalidateQueries({ queryKey: ['important-events'] });

    return data;
  },

  /**
   * Delete an important event
   */
  async deleteImportantEvent(id: string, contactId: string): Promise<void> {
    const { error } = await supabase
      .from('important_events')
      .delete()
      .eq('id', id);

    if (error) throw error;

    // Recalculate next due date since an important event was removed
    await this.recalculateNextContactDue(contactId);

    // Invalidate important events cache so the UI updates
    getQueryClient().invalidateQueries({ queryKey: ['important-events'] });
  },

  /**
   * Calculate the next due date considering both regular frequency and important events
   */
  async recalculateNextContactDue(contactId: string, skipRegularReminder = false): Promise<void> {
    const contact = await this.getContact(contactId);
    if (!contact) throw new Error('Contact not found');

    // Get user's timezone preference
    const { data: userPref } = await supabase
      .from('user_preferences')
      .select('timezone')
      .eq('user_id', contact.user_id)
      .single();

    // Use UTC if no timezone preference is set
    const timezone = userPref?.timezone || 'UTC';

    const importantEvents = await this.getImportantEvents(contactId);

    // Calculate regular next due date with user's timezone
    const regularDueDate = calculateNextContactDate(
      contact.contact_frequency as ContactFrequency,
      contact.missed_interactions,
      contact.last_contacted ? new Date(contact.last_contacted) : null,
      timezone  // Pass the user's timezone
    );

    // Find next important event date considering yearly recurrence
    const today = dayjs().startOf('day');
    const nextImportantEvent = importantEvents
      .map(event => {
        // Use the same logic as getNextOccurrence
        let eventDate = dayjs.utc(event.date).startOf('day');
        eventDate = eventDate.year(today.year());
        if (eventDate.isBefore(today)) {
          eventDate = eventDate.add(1, 'year');
        }
        return eventDate.toDate();
      })
      .sort((a, b) => a.getTime() - b.getTime())[0];

    // Determine next due date considering today's date
    let nextDueDate = regularDueDate;
    
    if (nextImportantEvent) {
      // If regular date is today, prefer important event date (which will be in future if today)
      if (dayjs(regularDueDate).isSame(today, 'day')) {
        nextDueDate = nextImportantEvent;
      }
      // If important event is not today and is earlier, use it
      else if (!dayjs(nextImportantEvent).isSame(today, 'day') && nextImportantEvent < regularDueDate) {
        nextDueDate = nextImportantEvent;
      }
    }

    // Update contact and create/update reminder
    const { error: updateError } = await supabase
      .from('contacts')
      .update({ next_contact_due: nextDueDate.toISOString() })
      .eq('id', contactId);

    if (updateError) throw updateError;

    // Only modify regular reminders if we're not in quick reminder flow
    if (!skipRegularReminder) {
      // Delete existing regular reminder (without name field)
      // This preserves quick reminders which have a name field
      const { error: deleteError } = await supabase
        .from('reminders')
        .delete()
        .eq('contact_id', contactId)
        .is('name', null);  // Only delete reminders without a name (regular reminders)

      if (deleteError) throw deleteError;

      // Create new regular reminder
      const { error: reminderError } = await supabase
        .from('reminders')
        .insert({
          contact_id: contactId,
          user_id: contact.user_id,
          type: contact.preferred_contact_method || 'message',
          due_date: nextDueDate.toISOString(),
          completed: false
        });

      if (reminderError) throw reminderError;
    }

    // Invalidate reminders cache
    getQueryClient().invalidateQueries({ queryKey: ['reminders'] });
    getQueryClient().invalidateQueries({ queryKey: ['total-reminders'] });
  },

  async updateContact(id: string, updates: Partial<Contact>): Promise<Contact> {
    // Get current contact data for calculations
    const contact = await this.getContact(id);
    if (!contact) throw new Error('Contact not found');

    // Clear the contact cache since we're updating data
    contactCacheService.clear();

    // Save the base updates
    const { data, error } = await supabase
      .from('contacts')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;

    // Recalculate next due date if necessary fields were updated
    if (updates.last_contacted ||        
        updates.contact_frequency) {
      await this.recalculateNextContactDue(id);
      // Get the final state after recalculation
      const updatedContact = await this.getContact(id);
      if (!updatedContact) throw new Error('Failed to retrieve updated contact');
      // Invalidate all caches after update that required recalculation
      getQueryClient().invalidateQueries({ queryKey: ['reminders'] });
      getQueryClient().invalidateQueries({ queryKey: ['total-reminders'] });
      getQueryClient().invalidateQueries({ queryKey: ['contacts'] });
      getQueryClient().invalidateQueries({ queryKey: ['recent-contacts'] });
      getQueryClient().invalidateQueries({ queryKey: ['total-contacts'] });
      getQueryClient().invalidateQueries({ queryKey: ['contact-hashtags'] });
      getQueryClient().invalidateQueries({ queryKey: ['expanded-contact'] });
      getQueryClient().invalidateQueries({ queryKey: ['important-events'] });
      return updatedContact;
    }

    // Invalidate all related caches for non-recalculation updates
    getQueryClient().invalidateQueries({ queryKey: ['contacts'] });
    getQueryClient().invalidateQueries({ queryKey: ['recent-contacts'] });
    getQueryClient().invalidateQueries({ queryKey: ['total-contacts'] });
    getQueryClient().invalidateQueries({ queryKey: ['contact-hashtags'] });
    getQueryClient().invalidateQueries({ queryKey: ['expanded-contact'] });
    getQueryClient().invalidateQueries({ queryKey: ['important-events'] });
    getQueryClient().invalidateQueries({ queryKey: ['reminders'] });
    getQueryClient().invalidateQueries({ queryKey: ['total-reminders'] });
    return data;
  },

  async deleteContact(id: string): Promise<void> {
    // Clear the contact cache
    contactCacheService.clear();

    // Delete all interactions for this contact
    const { error: interactionsError } = await supabase
      .from('interactions')
      .delete()
      .eq('contact_id', id);
    
    if (interactionsError) throw interactionsError;
  
    // Delete all reminders for this contact
    const { error: remindersError } = await supabase
      .from('reminders')
      .delete()
      .eq('contact_id', id);
    
    if (remindersError) throw remindersError;
  
    // Important events will be automatically deleted due to ON DELETE CASCADE
  
    // Finally delete the contact
    const { error: contactError } = await supabase
      .from('contacts')
      .delete()
      .eq('id', id);
    
    if (contactError) throw contactError;
  
    // Invalidate all related caches after deletion
    getQueryClient().invalidateQueries({ queryKey: ['contacts'] });
    getQueryClient().invalidateQueries({ queryKey: ['recent-contacts'] });
    getQueryClient().invalidateQueries({ queryKey: ['total-contacts'] });
    getQueryClient().invalidateQueries({ queryKey: ['contact-hashtags'] });
    getQueryClient().invalidateQueries({ queryKey: ['important-events'] });
    getQueryClient().invalidateQueries({ queryKey: ['reminders'] });
    getQueryClient().invalidateQueries({ queryKey: ['total-reminders'] });
  
  },

  async getInteractions(contactId: string): Promise<Interaction[]> {
    const { data, error } = await supabase
      .from('interactions')
      .select(`
        id,
        user_id,
        contact_id,
        type,
        date,
        notes,
        sentiment,
        created_at
      `)
      .eq('contact_id', contactId)
      .order('date', { ascending: false });
    
    if (error) throw error;
    return data || [];
  },

  async addInteraction(interaction: Omit<Interaction, 'id' | 'created_at'>): Promise<Interaction> {
    // Use the new combined function to log interaction and update contact
    const { data, error } = await supabase
      .rpc('log_interaction_and_update_contact', {
        p_contact_id: interaction.contact_id,
        p_user_id: interaction.user_id,
        p_type: interaction.type,
        p_date: interaction.date,
        p_notes: interaction.notes || null,
        p_sentiment: interaction.sentiment || null
      });

    if (error) throw error;

    // Get the created interaction data
    const { data: interactionData, error: fetchError } = await supabase
      .from('interactions')
      .select()
      .eq('id', data[0].interaction_id)
      .single();

    if (fetchError) throw fetchError;
    return interactionData;
  },

  async getTotalContactCount(): Promise<number> {
    // Use ranged queries to get total count beyond 1000
    let totalCount = 0;
    let page = 0;
    const pageSize = 950; // Match the chunk size being used elsewhere
    
    while (true) {
      const { data, error, count } = await supabase
        .from('contacts')
        .select('*', { count: 'exact' })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (error) throw error;
      
      // If no more data or count is available, break
      if (!data || data.length === 0) break;
      
      // If count is available, use it and break (optimization)
      if (count !== null) {
        totalCount = count;
        break;
      }
      
      // Otherwise, add the chunk size and continue
      totalCount += data.length;
      
      // If we got less than pageSize, we've reached the end
      if (data.length < pageSize) break;
      
      page++;
    }
    
    return totalCount;
  },

  async getTotalReminderCount(): Promise<number> {
    // Use ranged queries to get total count beyond 1000
    let totalCount = 0;
    let page = 0;
    const pageSize = 950; // Match the chunk size being used elsewhere
    
    while (true) {
      const { data, error, count } = await supabase
        .from('reminders')
        .select('*', { count: 'exact' })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (error) throw error;
      
      // If no more data or count is available, break
      if (!data || data.length === 0) break;
      
      // If count is available, use it and break (optimization)
      if (count !== null) {
        totalCount = count;
        break;
      }
      
      // Otherwise, add the chunk size and continue
      totalCount += data.length;
      
      // If we got less than pageSize, we've reached the end
      if (data.length < pageSize) break;
      
      page++;
    }
    
    return totalCount;
  },

  async getReminders(contactId?: string): Promise<Reminder[]> {
    const { isPremium, isOnTrial } = useStore.getState();
    
    // For free users, get the IDs of their 15 most recent contacts
    let visibleContactIds: string[] = [];
    if (!isPremium && !isOnTrial) {
      // Always get visible contacts for free users
      visibleContactIds = await freeContactsService.getVisibleContactIds();
    }

    // Use chunked fetching for reminders to handle large datasets
    let allReminders: Reminder[] = [];
    let page = 0;
    const pageSize = 950;

    while (true) {
      let query = supabase
        .from('reminders')
        .select(`
          id,
          contact_id,
          user_id,
          type,
          name,
          due_date,
          completed,
          created_at,
          contact:contacts!inner(name)
        `)
        .order('due_date')
        .order('contact(name)')
        .range(page * pageSize, (page + 1) * pageSize - 1);
      
      if (contactId) {
        // For free users, only show reminders if contact is in visible 15
        if (!isPremium && !isOnTrial) {
          if (!visibleContactIds.includes(contactId)) {
            return []; // Return empty if trying to access non-visible contact
          }
        }
        query = query.eq('contact_id', contactId);
      } else if (!isPremium && !isOnTrial) {
        // Filter to only visible contacts
        query = query.in('contact_id', visibleContactIds);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      if (!data || data.length === 0) break;

      // Transform the data to match the Reminder type exactly
      const transformedData = data.map(item => ({
        ...item,
        contact: {
          name: item.contact[0]?.name || ''
        }
      }));

      allReminders = [...allReminders, ...transformedData];

      // If we got less than pageSize, we've reached the end
      if (data.length < pageSize) break;

      page++;
    }
    
    return allReminders;
  },

  async updateInteraction(id: string, updates: Partial<Interaction>): Promise<Interaction> {
    const { data, error } = await supabase
      .from('interactions')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async deleteInteraction(id: string): Promise<void> {
    const { error } = await supabase
      .from('interactions')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  },

  async addReminder(reminder: Omit<Reminder, 'id' | 'created_at'>): Promise<Reminder> {
    // Delete any existing regular reminders for this contact
    // Quick reminders with a name field are preserved
    const { error: deleteError } = await supabase
      .from('reminders')
      .delete()
      .eq('contact_id', reminder.contact_id)
      .is('name', null);  // Only delete reminders without a name (regular reminders)
    
    if (deleteError) throw deleteError;

    // Create the new reminder
    const { data, error } = await supabase
      .from('reminders')
      .insert(reminder)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async updateReminder(id: string, updates: Partial<Reminder>): Promise<Reminder> {
    const { data, error } = await supabase
      .from('reminders')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  /**
   * Add a quick reminder that is not tied to recurring contact schedules
   * These reminders are one-time only and are removed once completed
   */
  /**
   * Complete a quick reminder without logging an interaction
   * Unlike regular reminders which are completed via interactions,
   * quick reminders are simply marked as completed and then deleted
   */
  async completeQuickReminder(id: string): Promise<void> {
    // Get reminder details and verify it's a quick reminder
    const { data: reminderData, error: fetchError } = await supabase
      .from('reminders')
      .select('id, name, contact_id, user_id')
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;
    if (!reminderData?.name) {
      throw new Error('Cannot complete a regular reminder directly. Log an interaction instead.');
    }

    // Get user's timezone preference
    const { data: userPref, error: prefError } = await supabase
      .from('user_preferences')
      .select('timezone')
      .eq('user_id', reminderData.user_id)
      .single();

    if (prefError) throw prefError;

    // Use UTC if no timezone preference is set
    const timezone = userPref?.timezone || 'UTC';

    // Delete the quick reminder
    const { error: deleteError } = await supabase
      .from('reminders')
      .delete()
      .eq('id', id);

    if (deleteError) throw deleteError;

    // Delete corresponding important event if it exists
    const { error: eventDeleteError } = await supabase
      .from('important_events')
      .delete()
      .eq('contact_id', reminderData.contact_id)
      .eq('type', 'custom')
      .eq('name', reminderData.name);

    if (eventDeleteError) throw eventDeleteError;

    // Get current time in user's timezone and convert to ISO string
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: timezone })).toISOString();
    const { error: updateError } = await supabase
      .from('contacts')
      .update({ last_contacted: now })
      .eq('id', reminderData.contact_id);

    if (updateError) throw updateError;

    // Recalculate next contact due date and invalidate caches
    await this.recalculateNextContactDue(reminderData.contact_id);
    getQueryClient().invalidateQueries({ queryKey: ['reminders'] });
    getQueryClient().invalidateQueries({ queryKey: ['total-reminders'] });
    getQueryClient().invalidateQueries({ queryKey: ['important-events'] });
  },

  async addQuickReminder(reminder: QuickReminderInput): Promise<Reminder> {
    const contact = await this.getContact(reminder.contact_id);
    if (!contact) throw new Error('Contact not found');

    // Create the quick reminder directly, without deleting existing reminders
    // since quick reminders can coexist with regular reminders
    const { data, error } = await supabase
      .from('reminders')
      .insert({
        contact_id: reminder.contact_id,
        user_id: contact.user_id,
        type: reminder.type,
        name: reminder.name,  // Store the quick reminder name
        due_date: reminder.due_date,
        completed: false
      })
      .select()
      .single();
    
    if (error) throw error;

    // If marked as important, create an important event entry
    // Pass skipRegularReminder=true to prevent creating a regular reminder during recalculation
    if (reminder.is_important) {
      await this.addImportantEvent({
        contact_id: reminder.contact_id,
        user_id: contact.user_id,
        type: 'custom',
        name: reminder.name,
        date: reminder.due_date
      }, true); // Pass skipRegularReminder flag
    }

    // Invalidate reminders cache
    getQueryClient().invalidateQueries({ queryKey: ['reminders'] });
    getQueryClient().invalidateQueries({ queryKey: ['total-reminders'] });
    
    return data;
  },

  async deleteReminder(id: string): Promise<void> {
    const { error } = await supabase
      .from('reminders')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  },

  /**
   * Delete multiple contacts and their associated data in bulk
   * @param contactIds Array of contact IDs to delete
   */
  async bulkDeleteContacts(contactIds: string[]): Promise<void> {
    if (!contactIds.length) return;

    // Clear the contact cache before bulk deletion
    contactCacheService.clear();

    // Process deletions in smaller chunks to avoid URL length limitations
    const chunkSize = 25; // Reduced chunk size for better reliability
    const failedIds: string[] = [];

    for (let i = 0; i < contactIds.length; i += chunkSize) {
      const chunk = contactIds.slice(i, i + chunkSize);
      
      try {
        // Delete contacts first and let the database cascade handle related data
        // This ensures that if the process is interrupted, we don't have orphaned data
        const { error: contactError } = await supabase
          .from('contacts')
          .delete()
          .in('id', chunk);
        
        if (contactError) {
          console.error('Error deleting contacts:', contactError);
          failedIds.push(...chunk);
        }

        // Add a small delay between chunks to prevent rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`Failed to delete chunk ${i / chunkSize + 1}:`, error);
        failedIds.push(...chunk);
      }
    }

    // If any deletions failed, try one more time with the failed IDs
    if (failedIds.length > 0) {
      console.log(`Retrying deletion for ${failedIds.length} failed contacts...`);
      
      try {
        const { error: retryError } = await supabase
          .from('contacts')
          .delete()
          .in('id', failedIds);

        if (retryError) {
          console.error('Error in retry deletion:', retryError);
          throw new Error(`Failed to delete ${failedIds.length} contacts after retry`);
        }
      } catch (error) {
        console.error('Final retry failed:', error);
        throw new Error(`Failed to delete ${failedIds.length} contacts after retry`);
      }
    }

    // Invalidate all related caches after bulk deletion is complete
    getQueryClient().invalidateQueries({ queryKey: ['contacts'] });
    getQueryClient().invalidateQueries({ queryKey: ['recent-contacts'] });
    getQueryClient().invalidateQueries({ queryKey: ['total-contacts'] });
    getQueryClient().invalidateQueries({ queryKey: ['contact-hashtags'] });
    getQueryClient().invalidateQueries({ queryKey: ['important-events'] });
    getQueryClient().invalidateQueries({ queryKey: ['reminders'] });
    getQueryClient().invalidateQueries({ queryKey: ['total-reminders'] });
  },

  async handleMissedInteraction(contactId: string): Promise<void> {
    const contact = await this.getContact(contactId);
    if (!contact) throw new Error('Contact not found');

    const newMissedCount = (contact.missed_interactions || 0) + 1;
    // For missed interactions, use last_contacted as base date if available
    const baseDate = contact.last_contacted ? new Date(contact.last_contacted) : null;
    const nextContactDue = calculateNextContactDate(
      contact.contact_frequency as ContactFrequency,
      newMissedCount,
      baseDate
    );

    // Delete existing regular reminder (preserve quick reminders)
    const { error: deleteError } = await supabase
      .from('reminders')
      .delete()
      .eq('contact_id', contactId)
      .is('name', null);  // Only delete reminders without a name (regular reminders)
    
    if (deleteError) throw deleteError;

    // Create new reminder for the recalculated next due date
    const { error: reminderError } = await supabase
      .from('reminders')
      .insert({
        contact_id: contactId,
        user_id: contact.user_id,
        type: contact.preferred_contact_method || 'message',
        due_date: nextContactDue.toISOString(),
        completed: false
      });

    if (reminderError) throw reminderError;

    // Update contact with new missed count and next due date
    const { error: updateError } = await supabase
      .from('contacts')
      .update({
        missed_interactions: newMissedCount,
        next_contact_due: nextContactDue.toISOString()
      })
      .eq('id', contactId);

    if (updateError) throw updateError;
  }
};