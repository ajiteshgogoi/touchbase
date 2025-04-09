import { ReactNode, useEffect } from 'react';
import { Navbar } from './Navbar';
import { getFullVersion } from '../../../version/version';
import { useStore } from '../../stores/useStore';
import { supabase } from '../../lib/supabase/client';
import { useQuery } from '@tanstack/react-query';

interface LayoutProps {
  children: ReactNode;
}

export const Layout = ({ children }: LayoutProps) => {
  const { user } = useStore();

  // Get user preferences including theme
  // Get theme from localStorage first, then try to sync with server preferences
  const savedTheme = localStorage.getItem('theme') || 'light';
  
  // Apply theme whenever preferences change
  // Subscribe to preference changes only if user is logged in
  const { data: preferences } = useQuery({
    queryKey: ['preferences', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('user_preferences')
        .select('theme')
        .eq('user_id', user.id)
        .single();
      
      if (error && error.code !== 'PGRST116') {
        throw error;
      }
      if (data?.theme) {
        localStorage.setItem('theme', data.theme);
      }
      return data;
    },
    enabled: !!user?.id
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const currentTheme = preferences?.theme || savedTheme;
    
    const applyTheme = () => {
      const isDark =
        currentTheme === 'dark' ||
        (currentTheme === 'system' && mediaQuery.matches);
      
      document.documentElement.classList.toggle('dark', isDark);
    };
  
    applyTheme(); // Initial application
    
    // Listen for system theme changes
    const handleChange = () => {
      if (currentTheme === 'system') {
        applyTheme();
      }
    };
    
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [preferences?.theme, savedTheme]); // Re-run when theme changes

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