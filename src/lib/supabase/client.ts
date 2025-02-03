import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

export const getCurrentUser = async () => {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) throw error;
    return user;
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
};

export const signInWithGoogle = async () => {
  try {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${import.meta.env.VITE_APP_URL}/auth/callback`,
      },
    });
    if (error) throw error;
  } catch (error) {
    console.error('Error signing in with Google:', error);
    throw error;
  }
};

export const signOut = async () => {
  try {
    // Clear any stored state first
    localStorage.removeItem('supabase.auth.token');
    sessionStorage.removeItem('supabase.auth.token');
    
    // Sign out from Supabase
    const { error } = await supabase.auth.signOut({
      scope: 'global' // Sign out from all sessions
    });
    
    if (error) throw error;
    
    // Reset application state
    window.location.href = '/login';
  } catch (error) {
    console.error('Error signing out:', error);
    // Force reload even on error to ensure clean state
    window.location.href = '/login';
  }
};