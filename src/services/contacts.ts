import { supabase } from '../lib/supabase/client';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import type { Contact, Interaction, Reminder, ImportantEvent } from '../lib/supabase/types';
import { paymentService } from './payment';
import { getQueryClient } from '../utils/queryClient';
import { calculateNextContactDate, RelationshipLevel, ContactFrequency} from '../utils/date';

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
    
    // Use last_contacted as base date if provided, otherwise use current date
    const baseDate = contact.last_contacted ? new Date(contact.last_contacted) : null;
    const nextContactDue = calculateNextContactDate(
      contact.relationship_level as RelationshipLevel,
      contact.contact_frequency as ContactFrequency | null,
      0,
      baseDate
    ).toISOString();

    // First create the contact to get its ID
    const { data, error } = await supabase
      .from('contacts')
      .insert({
        ...contact,
        next_contact_due: nextContactDue,
        missed_interactions: 0
      })
      .select()
      .single();
      
    if (error) throw error;

    // Then create the initial reminder
    const { error: reminderError } = await supabase
      .from('reminders')
      .insert({
        contact_id: data.id,
        user_id: data.user_id,
        type: data.preferred_contact_method || 'message',
        due_date: nextContactDue,
        completed: false
      });

    if (reminderError) throw reminderError;
    
    // Invalidate reminders cache after creating a new reminder
    getQueryClient().invalidateQueries({ queryKey: ['reminders'] });
    
    return data;
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
  async addImportantEvent(event: Omit<ImportantEvent, 'id' | 'created_at' | 'updated_at'>): Promise<ImportantEvent> {
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
    await this.recalculateNextContactDue(event.contact_id);

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
  async recalculateNextContactDue(contactId: string): Promise<void> {
    const contact = await this.getContact(contactId);
    if (!contact) throw new Error('Contact not found');

    const importantEvents = await this.getImportantEvents(contactId);

    // Calculate regular next due date
    const regularDueDate = calculateNextContactDate(
      contact.relationship_level as RelationshipLevel,
      contact.contact_frequency as ContactFrequency | null,
      contact.missed_interactions,
      contact.last_contacted ? new Date(contact.last_contacted) : null
    );

    // Find next important event date (if any)
    const today = new Date();
    const nextImportantEvent = importantEvents
      .map(event => new Date(event.date))
      .filter(date => date > today)
      .sort((a, b) => a.getTime() - b.getTime())[0];

    // Use the earlier of regular due date and next important event
    const nextDueDate = nextImportantEvent && nextImportantEvent < regularDueDate
      ? nextImportantEvent
      : regularDueDate;

    // Update contact and create/update reminder
    const { error: updateError } = await supabase
      .from('contacts')
      .update({ next_contact_due: nextDueDate.toISOString() })
      .eq('id', contactId);

    if (updateError) throw updateError;

    // Delete existing reminder
    const { error: deleteError } = await supabase
      .from('reminders')
      .delete()
      .eq('contact_id', contactId);

    if (deleteError) throw deleteError;

    // Create new reminder
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

    // Invalidate reminders cache
    getQueryClient().invalidateQueries({ queryKey: ['reminders'] });
  },

  async updateContact(id: string, updates: Partial<Contact>): Promise<Contact> {
    // Get current contact data for calculations
    const contact = await this.getContact(id);
    if (!contact) throw new Error('Contact not found');

    let updatedFields = { ...updates };
    
    // Only recalculate next_contact_due if we have a last_contacted date
    if (updates.last_contacted ||
        (updates.relationship_level || updates.contact_frequency) && contact.last_contacted) {
      const level = (updates.relationship_level || contact.relationship_level) as RelationshipLevel;
      const frequency = (updates.contact_frequency || contact.contact_frequency) as ContactFrequency | null;
      
      // Always use the most recent last_contacted date for calculations
      const baseDate = updates.last_contacted ? new Date(updates.last_contacted) :
                      contact.last_contacted ? new Date(contact.last_contacted) : null;
      
      if (baseDate) {
        updatedFields.next_contact_due = calculateNextContactDate(
          level,
          frequency,
          0, // Reset missed interactions when updating contact
          baseDate
        ).toISOString();

        // Always remove existing reminders before creating new ones
        const { error: deleteError } = await supabase
          .from('reminders')
          .delete()
          .eq('contact_id', id);
        
        if (deleteError) throw deleteError;
        
        // Create new reminder for next contact due date
        const { error: reminderError } = await supabase
          .from('reminders')
          .insert({
            contact_id: id,
            user_id: contact.user_id,
            type: contact.preferred_contact_method || 'message',
            due_date: updatedFields.next_contact_due,
            completed: false
          });

        if (reminderError) throw reminderError;
        
        // Invalidate reminders cache after updating a reminder
        getQueryClient().invalidateQueries({ queryKey: ['reminders'] });
      }
    }

    const { data, error } = await supabase
      .from('contacts')
      .update(updatedFields)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
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
    // Just record the interaction without handling reminders
    const { data: interactionData, error: interactionError } = await supabase
      .from('interactions')
      .insert(interaction)
      .select()
      .single();
    
    if (interactionError) throw interactionError;
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
    // Delete any existing reminders for this contact
    const { error: deleteError } = await supabase
      .from('reminders')
      .delete()
      .eq('contact_id', reminder.contact_id);
    
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
      contact.relationship_level as RelationshipLevel,
      contact.contact_frequency as ContactFrequency | null,
      newMissedCount,
      baseDate
    );

    // Delete existing reminders since we're creating a new one
    const { error: deleteError } = await supabase
      .from('reminders')
      .delete()
      .eq('contact_id', contactId);
    
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