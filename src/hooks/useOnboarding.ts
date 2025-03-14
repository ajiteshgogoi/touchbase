import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase/client';

const ONBOARDING_COMPLETED_KEY = 'onboarding_completed';

interface OnboardingState {
  isCompleted: boolean;
  shouldShow: boolean;
  markCompleted: () => Promise<void>;
}

export function useOnboarding(): OnboardingState {
  const [isCompleted, setIsCompleted] = useState(false);
  const [shouldShow, setShouldShow] = useState(false);

  useEffect(() => {
    const checkOnboardingStatus = async () => {
      try {
        // Check local storage first for quick loading
        const localCompleted = localStorage.getItem(ONBOARDING_COMPLETED_KEY);
        if (localCompleted === 'true') {
          setIsCompleted(true);
          return;
        }

        // Get current user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setShouldShow(false);
          return;
        }

        // Check user preferences
        const { data: prefs } = await supabase
          .from('user_preferences')
          .select('onboarding_completed')
          .eq('user_id', user.id)
          .single();

        const completed = prefs?.onboarding_completed ?? false;
        setIsCompleted(completed);
        setShouldShow(!completed);

        // Cache the result
        localStorage.setItem(ONBOARDING_COMPLETED_KEY, String(completed));
      } catch (error) {
        console.error('Error checking onboarding status:', error);
        setShouldShow(false);
      }
    };

    checkOnboardingStatus();
  }, []);

  const markCompleted = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Update user preferences
      await supabase
        .from('user_preferences')
        .upsert({
          user_id: user.id,
          onboarding_completed: true
        }, {
          onConflict: 'user_id'
        });

      // Update local state
      setIsCompleted(true);
      setShouldShow(false);

      // Cache the result
      localStorage.setItem(ONBOARDING_COMPLETED_KEY, 'true');
    } catch (error) {
      console.error('Error marking onboarding as completed:', error);
    }
  };

  return {
    isCompleted,
    shouldShow,
    markCompleted
  };
}