import { supabase } from '../lib/supabase/client';
import type { Contact, Interaction, Reminder } from '../lib/supabase/types';

type ContactFrequency = 'daily' | 'weekly' | 'fortnightly' | 'monthly' | 'quarterly';
type RelationshipLevel = 1 | 2 | 3 | 4 | 5;

// Calculate next contact date based on relationship level, contact frequency, missed interactions, and base date
const getNextContactDate = (
  level: RelationshipLevel,
  frequency: ContactFrequency | null,
  missedInteractions: number = 0,
  baseDate?: Date | null
): Date => {
  // Use provided base date, fall back to current date
  const referenceDate = baseDate || new Date();
  // Base intervals in days
  const baseIntervals: Record<RelationshipLevel, number> = {
    1: 90,  // Acquaintance: ~3 months
    2: 60,  // Casual friend: ~2 months
    3: 30,  // Friend: ~1 month
    4: 14,  // Close friend: ~2 weeks
    5: 7    // Very close: ~1 week
  };

  // Default to base interval for the relationship level
  let days = baseIntervals[level];

  // Adjust based on specified frequency if provided
  if (frequency) {
    const frequencyDays: Record<ContactFrequency, number> = {
      daily: 1,
      weekly: 7,
      fortnightly: 14,
      monthly: 30,
      quarterly: 90
    };
    
    // Use the more frequent of the two options
    days = Math.min(days, frequencyDays[frequency]);
  }

  // Adjust interval based on missed interactions using exponential backoff
  if (missedInteractions > 0) {
    // Calculate reduced interval: divide by 2^missedInteractions
    // But ensure it doesn't go below 1 day to avoid overwhelming
    const reducedDays = Math.max(1, Math.floor(days / Math.pow(2, missedInteractions)));
    days = reducedDays;
  }

  // Helper to strip time and normalize to start of day
  const normalizeDate = (date: Date): Date => {
    const normalized = new Date(date);
    normalized.setHours(0, 0, 0, 0);
    return normalized;
  };

  // Get normalized reference and current dates
  const normalizedRef = normalizeDate(referenceDate);
  const normalizedNow = normalizeDate(new Date());

  // Calculate initial next date from reference
  const nextDate = new Date(normalizedRef);
  nextDate.setDate(nextDate.getDate() + days);
  
  // If calculated date would be in the past, use current date as base instead
  if (normalizeDate(nextDate) <= normalizedNow) {
    nextDate.setTime(normalizedNow.getTime());
    nextDate.setDate(nextDate.getDate() + days);
  }

  return normalizeDate(nextDate);
};

export const contactsService = {
  async getContacts(): Promise<Contact[]> {
    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .order('created_at', { ascending: false });
    
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

  async createContact(contact: Omit<Contact, 'id' | 'created_at' | 'updated_at'>): Promise<Contact> {
   // Use last_contacted as base date if provided, otherwise use current date
   const baseDate = contact.last_contacted ? new Date(contact.last_contacted) : null;
   const nextContactDue = getNextContactDate(
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
       description: data.notes || undefined
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
        updatedFields.next_contact_due = getNextContactDate(
          level,
          frequency,
          0, // Reset missed interactions when updating contact
          baseDate
        ).toISOString();

        // Check if this is a today's interaction
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const interactionDate = new Date(baseDate);
        interactionDate.setHours(0, 0, 0, 0);
        const isToday = interactionDate.getTime() === today.getTime();

        if (isToday) {
          // Remove any current reminders if this is today's interaction
          const { error: deleteError } = await supabase
            .from('reminders')
            .delete()
            .eq('contact_id', id);
          
          if (deleteError) throw deleteError;
        }
        
        // Create new reminder for next contact due date
        const { error: reminderError } = await supabase
          .from('reminders')
          .insert({
            contact_id: id,
            user_id: contact.user_id,
            type: contact.preferred_contact_method || 'message',
            due_date: updatedFields.next_contact_due,
            description: contact.notes || undefined
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
    let query = supabase
      .from('reminders')
      .select('*')
      .order('due_date');
    
    if (contactId) {
      query = query.eq('contact_id', contactId);
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

  // New method to handle missed interaction
  async handleMissedInteraction(contactId: string): Promise<void> {
    const contact = await this.getContact(contactId);
    if (!contact) throw new Error('Contact not found');

    const newMissedCount = (contact.missed_interactions || 0) + 1;
    // For missed interactions, use last_contacted as base date if available
    const baseDate = contact.last_contacted ? new Date(contact.last_contacted) : null;
    const nextContactDue = getNextContactDate(
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
        description: contact.notes || undefined
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