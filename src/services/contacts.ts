import { supabase } from '../lib/supabase/client';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import type { Contact, Interaction, Reminder } from '../lib/supabase/types';
import { paymentService } from './payment';
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
      .select('*')
      .order('created_at', { ascending: true });  // Get oldest first for free tier limit
    
    // For free tier, only get first 15 contacts
    if (!isPremium && !isOnTrial) {
      query = query.limit(15);
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
    
    return data;
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

  async getReminders(contactId?: string): Promise<Reminder[]> {
    const { isPremium, isOnTrial } = await paymentService.getSubscriptionStatus();
    
    // For free users, first get the visible contacts (first 15)
    let visibleContactIds: string[] = [];
    if (!isPremium && !isOnTrial && !contactId) {
      const { data: contacts } = await supabase
        .from('contacts')
        .select('id')
        .order('created_at', { ascending: true })
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