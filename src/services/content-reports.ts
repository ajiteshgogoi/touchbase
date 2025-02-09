import { supabase } from '../lib/supabase/client';

export const contentReportsService = {
  async reportContent(contactId: string, content: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('You must be logged in to report content');

    const { error } = await supabase
      .from('content_reports')
      .insert({
        user_id: user.id,
        contact_id: contactId,
        content
      });

    if (error) throw error;
  }
};