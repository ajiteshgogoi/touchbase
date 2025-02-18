import { supabase } from '../lib/supabase/client';

export const contentReportsService = {
  async reportContent(
    content: string,
    options: { contactId?: string; contentType: 'contact' | 'conversation-prompt' }
  ) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('You must be logged in to report content');

    const { error } = await supabase
      .from('content_reports')
      .insert({
        user_id: user.id,
        contact_id: options.contactId,
        content,
        content_type: options.contentType
      });

    if (error) throw error;
  }
};