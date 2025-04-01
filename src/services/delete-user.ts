import { supabase } from '../lib/supabase/client';

// Get the Edge Function URL from environment variables
const EDGE_FUNCTION_URL = import.meta.env.VITE_SUPABASE_URL?.replace('.supabase.co', '.functions.supabase.co');

export const deleteUserService = {
  async deleteAccount(): Promise<void> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('Not authenticated');
    }

    if (!EDGE_FUNCTION_URL) {
      throw new Error('Edge function URL not configured');
    }

    const response = await fetch(`${EDGE_FUNCTION_URL}/delete-user`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json'
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