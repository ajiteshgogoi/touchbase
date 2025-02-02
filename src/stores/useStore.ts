import { create } from 'zustand';
import type { Contact, UserPreferences } from '../lib/supabase/types';

interface StoreState {
  user: any | null;
  contacts: Contact[];
  isLoading: boolean;
  preferences: UserPreferences | null;
  isPremium: boolean;
  searchQuery: string;
  contactFilter: 'all' | 'due' | 'overdue';
  darkMode: boolean;
  setUser: (user: any | null) => void;
  setContacts: (contacts: Contact[]) => void;
  setIsLoading: (isLoading: boolean) => void;
  setPreferences: (preferences: UserPreferences | null) => void;
  setIsPremium: (isPremium: boolean) => void;
  setSearchQuery: (query: string) => void;
  setContactFilter: (filter: 'all' | 'due' | 'overdue') => void;
  setDarkMode: (darkMode: boolean) => void;
}

export const useStore = create<StoreState>((set) => ({
  user: null,
  contacts: [],
  isLoading: true,
  preferences: null,
  isPremium: false,
  searchQuery: '',
  contactFilter: 'all',
  darkMode: window.matchMedia('(prefers-color-scheme: dark)').matches,

  setUser: (user) => set({ user }),
  setContacts: (contacts) => set({ contacts }),
  setIsLoading: (isLoading) => set({ isLoading }),
  setPreferences: (preferences) => set({ preferences }),
  setIsPremium: (isPremium) => set({ isPremium }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setContactFilter: (contactFilter) => set({ contactFilter }),
  setDarkMode: (darkMode) => {
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