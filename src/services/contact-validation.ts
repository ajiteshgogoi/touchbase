import { supabase } from '../lib/supabase/client';

interface CheckDuplicateResponse {
  hasDuplicate: boolean;
  duplicates: Array<{
    id: string;
    name: string;
  }>;
}

interface DuplicateCheckOptions {
  name: string;
  userId: string;
  contactId?: string; // Optional: for update case
}

export const contactValidationService = {
  async checkDuplicateName({ name, userId, contactId }: DuplicateCheckOptions): Promise<CheckDuplicateResponse> {
    const { data, error } = await supabase.functions.invoke('check-duplicate-contact', {
      body: {
        name,
        user_id: userId,
        contact_id: contactId
      }
    });

    if (error) {
      console.error('Error checking for duplicate contact:', error);
      throw new Error('Failed to check for duplicate contact');
    }

    return data as CheckDuplicateResponse;
  },

  formatDuplicateMessage(duplicates: Array<{ name: string }>): string {
    const names = duplicates.map(d => d.name);
    if (names.length === 0) return '';
    
    if (names.length === 1) {
      return `You already have a contact named '${names[0]}'. Please add a differentiator (like a last name or nickname) to avoid confusion.`;
    }
    
    const lastPart = names.slice(-1)[0];
    const otherParts = names.slice(0, -1);
    return `You already have contacts named ${otherParts.map(n => `'${n}'`).join(', ')} and '${lastPart}'. Please add a differentiator (like a last name or nickname) to avoid confusion.`;
  }
};