import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient<Database>(
  supabaseUrl, 
  supabaseAnonKey,
  {
    auth: {
      persistSession: true, // Keep the session alive between page refreshes
      autoRefreshToken: true, // Automatically refresh the token before it expires
      detectSessionInUrl: true, // Required for OAuth sign-in
      storage: localStorage // Use localStorage for session persistence
    }
  }
);

export const getCurrentUser = async () => {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) {
      console.error('Error getting current user:', error);
      return null;
    }
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
        queryParams: {
          access_type: 'offline', // This requests a refresh token from Google //
          prompt: 'consent', // This ensures we always get a refresh token
          app_name: import.meta.env.VITE_APP_NAME, // Set the application name in consent screen
          application_name: import.meta.env.VITE_APP_NAME // Alternative parameter for app name
        }
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
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    
    // Give a moment for Supabase to complete the signout
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Redirect to login page
    window.location.href = '/login';
  } catch (error) {
    console.error('Error signing out:', error);
    // Force reload to clear any stale state
    window.location.href = '/login';
  }
};