import { ReactNode, useEffect } from 'react';
import { Navbar } from './Navbar';
import { getFullVersion } from '../../../version/version';
import type { User } from '@supabase/supabase-js';
import { useStore } from '../../stores/useStore';
import { supabase } from '../../lib/supabase/client';

interface LayoutProps {
  children: ReactNode;
  user?: User | null;
}

export const Layout = ({ children }: LayoutProps) => {
  const { user } = useStore();

  useEffect(() => {
    const initializeTheme = async () => {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      let theme = 'system';

      // Get user preferences from database if logged in
      if (user?.id) {
        const { data: preferences } = await supabase
          .from('user_preferences')
          .select('theme')
          .eq('user_id', user.id)
          .single();
        
        if (preferences?.theme) {
          theme = preferences.theme;
        }
      }
      
      const isDark =
        theme === 'dark' ||
        (theme === 'system' && mediaQuery.matches);
      
      document.documentElement.classList.toggle('dark', isDark);
      
      // Listen for system theme changes if using system preference
      const handleChange = () => {
        if (theme === 'system') {
          document.documentElement.classList.toggle('dark', mediaQuery.matches);
        }
      };
      
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    };

    // Initialize theme and store cleanup function
    let cleanup: (() => void) | undefined;
    initializeTheme().then(cleanupFn => {
      cleanup = cleanupFn;
    });

    // Return cleanup function
    return () => {
      if (cleanup) {
        cleanup();
      }
    };
  }, [user?.id]);

  return (
    <div className="min-h-screen min-w-[320px] bg-gradient-to-br from-primary-50 to-white dark:from-gray-900 dark:to-black flex flex-col">
      <Navbar />
      <main className="w-full min-w-[320px] min-h-[600px] max-w-4xl mx-auto px-4 pb-4 pt-8 flex-grow">
        <div className="w-full h-full min-h-[600px] bg-white dark:bg-gray-900 rounded-xl shadow-soft dark:shadow-soft-dark p-6">
          {children}
        </div>
      </main>
      <footer className="text-center pt-2 pb-5 text-gray-600 dark:text-gray-400 text-sm">
        <div className="inline-flex justify-center w-[320px]">
          © {new Date().getFullYear()} TouchBase Technologies | {getFullVersion()}
        </div>
      </footer>
    </div>
  );
};