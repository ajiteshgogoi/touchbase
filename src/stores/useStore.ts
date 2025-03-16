import create from 'zustand';
import type { Contact, UserPreferences } from '../lib/supabase/types';
import type { User } from '@supabase/supabase-js';
import { type StoreApi } from 'zustand/vanilla';

type Store = {
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

export const useStore = create<Store>((set: StoreApi<Store>['setState']) => ({
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

  setUser: (user: User | null) => set({ user }),
  setContacts: (contacts: Contact[]) => set({ contacts }),
  setIsLoading: (isLoading: boolean) => set({ isLoading }),
  setPreferences: (preferences: UserPreferences | null) => set({ preferences }),
  setIsPremium: (isPremium: boolean) => set({ isPremium }),
  setTrialStatus: (isOnTrial: boolean, trialDaysRemaining: number | null) => set({ isOnTrial, trialDaysRemaining }),
  setSearchQuery: (searchQuery: string) => set({ searchQuery }),
  setContactFilter: (contactFilter: 'all' | 'due') => set({ contactFilter }),
  setDarkMode: (darkMode: boolean) => {
    set({ darkMode });
    document.documentElement.classList.toggle('dark', darkMode);
  },
}));

// Subscribe to system dark mode changes
if (typeof window !== 'undefined') {
  window
    .matchMedia('(prefers-color-scheme: dark)')
    .addEventListener('change', (e) => {
      useStore.getState().setDarkMode(e.matches);
    });
}