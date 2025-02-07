import { supabase } from '../lib/supabase/client';

export const deleteUserService = {
  async deleteAccount(): Promise<void> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-user`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Delete account response:', {
        status: response.status,
        statusText: response.statusText,
        error: errorData
      });
      
      const errorMessage = errorData.error 
        ? `Failed to delete account: ${errorData.error}` 
        : `Failed to delete account (${response.status} ${response.statusText})`;
      
      throw new Error(errorMessage);
    }

    // Clear local auth state
    await supabase.auth.signOut();
  }
};