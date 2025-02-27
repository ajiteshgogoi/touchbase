import { supabase } from '../lib/supabase/client';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import type { Contact, Interaction, Reminder, ImportantEvent, QuickReminderInput } from '../lib/supabase/types';
import { paymentService } from './payment';
import { getQueryClient } from '../utils/queryClient';
import { calculateNextContactDate, ContactFrequency } from '../utils/date';

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

  async getContacts(): Promise<Contact[]> {
    const { isPremium, isOnTrial } = await paymentService.getSubscriptionStatus();

    let query = supabase
      .from('contacts')
      .select('*');

    // For free tier users, we show the 15 most recent contacts
    // This ensures users have access to their newest and most relevant contacts
    if (!isPremium && !isOnTrial) {
      query = query
        .order('created_at', { ascending: false })  // Get newest contacts first
        .limit(15);
    } else {
      // For premium/trial users, return all contacts with no specific ordering
      // The UI components can handle sorting as needed
      query = query.order('created_at', { ascending: true });
    }

    const { data, error } = await query;
    
    if (error) throw error;
    return data || [];
  },

  async getContactWithEvents(id: string): Promise<{contact: Contact | null, events: ImportantEvent[]}> {
    const [contactResult, eventsResult] = await Promise.all([
      supabase
        .from('contacts')
        .select('*')
        .eq('id', id)
        .single(),
      supabase
        .from('important_events')
        .select('*')
        .eq('contact_id', id)
        .order('date')
    ]);
    
    if (contactResult.error) throw contactResult.error;
    if (eventsResult.error) throw eventsResult.error;
    
    return {
      contact: contactResult.data,
      events: eventsResult.data || []
    };
  },

  async getContact(id: string): Promise<Contact | null> {
    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data;
  },

  async checkContactLimit(): Promise<void> {
    const { isPremium, isOnTrial } = await paymentService.getSubscriptionStatus();
    if (isPremium || isOnTrial) return;

    const contacts = await this.getContacts();
    if (contacts.length >= 15) {
      throw new Error('Free tier contact limit reached. Please upgrade to add more contacts.');
    }
  },

  async createContact(contact: Omit<Contact, 'id' | 'created_at' | 'updated_at'>): Promise<Contact> {
    await this.checkContactLimit();
    
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
        next_contact_due: now.toISOString(), // Temporary date, will be recalculated
        last_contacted: now.toISOString(), // Set initial last_contacted in user's timezone
        missed_interactions: 0
      })
      .select()
      .single();
      
    if (error) throw error;

    // After contact is created, calculate next due date considering important events
    await this.recalculateNextContactDue(data.id);
    
    // Invalidate reminders and contacts cache after creating a new contact
    getQueryClient().invalidateQueries({ queryKey: ['reminders'] });
    getQueryClient().invalidateQueries({ queryKey: ['contacts'] });
    
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
    let query = supabase
      .from('important_events')
      .select('*')
      .order('date');

    if (contactId) {
      query = query.eq('contact_id', contactId);
    }

    const { data, error } = await query;
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
  },

  async updateContact(id: string, updates: Partial<Contact>): Promise<Contact> {
    // Get current contact data for calculations
    const contact = await this.getContact(id);
    if (!contact) throw new Error('Contact not found');

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
      // Invalidate both caches after update
      getQueryClient().invalidateQueries({ queryKey: ['reminders'] });
      getQueryClient().invalidateQueries({ queryKey: ['contacts'] });
      return updatedContact;
    }

    // Invalidate contacts cache for non-recalculation updates
    getQueryClient().invalidateQueries({ queryKey: ['contacts'] });
    return data;
  },

  async deleteContact(id: string): Promise<void> {
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
  },

  async getInteractions(contactId: string): Promise<Interaction[]> {
    const { data, error } = await supabase
      .from('interactions')
      .select('*')
      .eq('contact_id', contactId)
      .order('date', { ascending: false });
    
    if (error) throw error;
    return data || [];
  },

  async addInteraction(interaction: Omit<Interaction, 'id' | 'created_at'>): Promise<Interaction> {
    // Record the interaction
    const { data: interactionData, error: interactionError } = await supabase
      .from('interactions')
      .insert(interaction)
      .select()
      .single();
    
    if (interactionError) throw interactionError;

    // Recalculate next due date considering important events
    await this.recalculateNextContactDue(interaction.contact_id);

    return interactionData;
  },

  async getTotalContactCount(): Promise<number> {
    const { count, error } = await supabase
      .from('contacts')
      .select('*', {
        count: 'exact',
        head: true  // Only get count, don't return actual rows
      });
    
    if (error) throw error;
    return count || 0;
  },

  async getReminders(contactId?: string): Promise<Reminder[]> {
    const { isPremium, isOnTrial } = await paymentService.getSubscriptionStatus();
    
    // For free users, get the IDs of their 15 most recent contacts
    // This ensures reminders align with the visible contacts in their list
    let visibleContactIds: string[] = [];
    if (!isPremium && !isOnTrial && !contactId) {
      const { data: contacts } = await supabase
        .from('contacts')
        .select('id')
        .order('created_at', { ascending: false }) // Get newest contacts first
        .limit(15);
      
      visibleContactIds = (contacts || []).map(c => c.id);
    }

    let query = supabase
      .from('reminders')
      .select('*')
      .order('due_date');
    
    if (contactId) {
      query = query.eq('contact_id', contactId);
    } else if (!isPremium && !isOnTrial) {
      query = query.in('contact_id', visibleContactIds);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    return data || [];
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
    
    return data;
  },

  async deleteReminder(id: string): Promise<void> {
    const { error } = await supabase
      .from('reminders')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
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