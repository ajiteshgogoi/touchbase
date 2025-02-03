import { supabase } from '../lib/supabase/client';
import type { Contact, Interaction, Reminder } from '../lib/supabase/types';

type ContactFrequency = 'daily' | 'weekly' | 'monthly' | 'quarterly';
type RelationshipLevel = 1 | 2 | 3 | 4 | 5;

// Calculate next contact date based on relationship level and contact frequency
const getNextContactDate = (
  level: RelationshipLevel,
  frequency: ContactFrequency | null
): Date => {
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
      monthly: 30,
      quarterly: 90
    };
    
    // Use the more frequent of the two options
    days = Math.min(days, frequencyDays[frequency]);
  }

  const nextDate = new Date();
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
};

export const contactsService = {
  async getContacts(): Promise<Contact[]> {
    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .order('name');
    
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
    // Calculate initial next_contact_due based on relationship level and frequency
    const nextContactDue = getNextContactDate(
      contact.relationship_level as RelationshipLevel,
      contact.contact_frequency as ContactFrequency | null
    ).toISOString();

    const { data, error } = await supabase
      .from('contacts')
      .insert({
        ...contact,
        next_contact_due: nextContactDue
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async updateContact(id: string, updates: Partial<Contact>): Promise<Contact> {
    // If relationship level or frequency is being updated, recalculate next_contact_due
    let updatedFields = { ...updates };
    
    if (updates.relationship_level || updates.contact_frequency) {
      const contact = await this.getContact(id);
      if (contact) {
        const level = (updates.relationship_level || contact.relationship_level) as RelationshipLevel;
        const frequency = (updates.contact_frequency || contact.contact_frequency) as ContactFrequency | null;
        updatedFields.next_contact_due = getNextContactDate(level, frequency).toISOString();
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
    const { error } = await supabase
      .from('contacts')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
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
    const { data, error } = await supabase
      .from('interactions')
      .insert(interaction)
      .select()
      .single();
    
    if (error) throw error;
    return data;
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

  async addReminder(reminder: Omit<Reminder, 'id' | 'created_at'>): Promise<Reminder> {
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
  }
};