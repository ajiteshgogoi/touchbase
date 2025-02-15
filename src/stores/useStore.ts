import { create } from 'zustand';
import { useEffect } from 'react';
import type { Contact, UserPreferences } from '../lib/supabase/types';
import type { User } from '@supabase/supabase-js';

interface StoreState {
  user: User | null;
  contacts: Contact[];
  isLoading: boolean;
  preferences: UserPreferences | null;
  isPremium: boolean;
  isOnTrial: boolean;
  trialDaysRemaining: number | null;
  searchQuery: string;
  contactFilter: 'all' | 'due';
  darkMode: boolean;
  setUser: (user: User | null) => void;
  setContacts: (contacts: Contact[]) => void;
  setIsLoading: (isLoading: boolean) => void;
  setPreferences: (preferences: UserPreferences | null) => void;
  setIsPremium: (isPremium: boolean) => void;
  setTrialStatus: (isOnTrial: boolean, daysRemaining: number | null) => void;
  setSearchQuery: (query: string) => void;
  setContactFilter: (filter: 'all' | 'due') => void;
  setDarkMode: (darkMode: boolean) => void;
}

export const useStore = create<StoreState>((set) => ({
  user: null,
  contacts: [],
  isLoading: false,
  preferences: null,
  isPremium: false,
  isOnTrial: false,
  trialDaysRemaining: null,
  searchQuery: '',
  contactFilter: 'all',
  darkMode: window.matchMedia('(prefers-color-scheme: dark)').matches,

  setUser: (user) => set({ user }),
  setContacts: (contacts) => set({ contacts }),
  setIsLoading: (isLoading) => set({ isLoading }),
  setPreferences: (preferences) => set({ preferences }),
  setIsPremium: (isPremium) => set({ isPremium }),
  setTrialStatus: (isOnTrial, trialDaysRemaining) => set({ isOnTrial, trialDaysRemaining }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setContactFilter: (contactFilter) => set({ contactFilter }),
  setDarkMode: (darkMode) => set({ darkMode }),
}));

// Hook for managing dark mode side effects
export const useDarkMode = () => {
  const darkMode = useStore((state) => state.darkMode);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  // Subscribe to system dark mode changes
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      useStore.getState().setDarkMode(e.matches);
    };

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);
};