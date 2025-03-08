import { useCallback } from 'react';
import { supabase } from '../lib/supabase/client';

export const useRatingSettings = () => {
  const updateRatingStatus = useCallback(async () => {
    try {
      const { error } = await supabase
        .from('user_settings')
        .update({
          has_rated_app: true
        })
        .eq('id', (await supabase.auth.getUser()).data.user?.id);

      if (error) {
        console.error('Error updating rating status:', error);
      }
    } catch (error) {
      console.error('Error in updateRatingStatus:', error);
    }
  }, []);

  const updateLastPromptTime = useCallback(async () => {
    try {
      const { error } = await supabase
        .from('user_settings')
        .update({
          last_rating_prompt: new Date().toISOString()
        })
        .eq('id', (await supabase.auth.getUser()).data.user?.id);

      if (error) {
        console.error('Error updating last prompt time:', error);
      }
    } catch (error) {
      console.error('Error in updateLastPromptTime:', error);
    }
  }, []);

  const initializeInstallTime = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error: selectError } = await supabase
        .from('user_settings')
        .select('install_time')
        .eq('id', user.id)
        .single();

      if (selectError) {
        console.error('Error checking install time:', selectError);
        return;
      }

      if (!data?.install_time) {
        const { error: updateError } = await supabase
          .from('user_settings')
          .update({
            install_time: new Date().toISOString()
          })
          .eq('id', user.id);

        if (updateError) {
          console.error('Error setting install time:', updateError);
        }
      }
    } catch (error) {
      console.error('Error in initializeInstallTime:', error);
    }
  }, []);

  return {
    updateRatingStatus,
    updateLastPromptTime,
    initializeInstallTime
  };
};