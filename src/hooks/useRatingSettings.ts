import { useCallback } from 'react';
import { supabase } from '../lib/supabase/client';

export const useRatingSettings = () => {
  const updateRatingStatus = useCallback(async (userId: string) => {
    try {
      const { error } = await supabase
        .from('user_preferences')
        .update({
          has_rated_app: true
        })
        .eq('user_id', userId);

      if (error) {
        console.error('Error updating rating status:', error);
      }
    } catch (error) {
      console.error('Error in updateRatingStatus:', error);
    }
  }, []);

  const updateLastPromptTime = useCallback(async (userId: string) => {
    try {
      const { error } = await supabase
        .from('user_preferences')
        .update({
          last_rating_prompt: new Date().toISOString()
        })
        .eq('user_id', userId);

      if (error) {
        console.error('Error updating last prompt time:', error);
      }
    } catch (error) {
      console.error('Error in updateLastPromptTime:', error);
    }
  }, []);

  const initializeInstallTime = useCallback(async (userId: string) => {
    try {
      const { data, error: selectError } = await supabase
        .from('user_preferences')
        .select('install_time')
        .eq('user_id', userId)
        .single();

      if (selectError) {
        console.error('Error checking install time:', selectError);
        return;
      }

      // Only set install_time if it hasn't been set yet
      if (!data?.install_time) {
        const { error: updateError } = await supabase
          .from('user_preferences')
          .update({
            install_time: new Date().toISOString()
          })
          .eq('user_id', userId);

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