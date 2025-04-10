import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const workerUrl = import.meta.env.VITE_WORKER_URL;
const clientSecret = import.meta.env.VITE_CLIENT_SECRET;

if (!workerUrl || !clientSecret) {
  throw new Error('Missing worker configuration');
}

export const supabase = createClient<Database>(
  workerUrl,
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNvbWVyZWYiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTY4NDc0MjAxOSwiZXhwIjoxODQyNTA4ODE5fQ.tJQ1kmXjQUL8Ku22GcZFlF0tPAQy9S99M8KGSDJoGFA', // API key for client initialization
  {
    global: {
      headers: {
        'X-Client-Secret': clientSecret
      }
    },
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: localStorage
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

export const getRecentUsers = async () => {
  try {
    const { data, error } = await supabase.functions.invoke('get-user-stats', {
      method: 'GET'
    });

    if (error) throw error;

    return {
      recentUsers: data.recentUsers || [],
      totalCount: data.totalCount || 0
    };
  } catch (error) {
    console.error('Error fetching user stats:', error);
    return { recentUsers: [], totalCount: 0 };
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
          prompt: 'consent' // This ensures we always get a refresh token
        }
      },
    });
    
    if (error) throw error;
  } catch (error) {
    console.error('Error signing in with Google:', error);
    throw error;
  }
};

// Import the chat store
import { useChatStore } from '../../stores/chatStore';

export const signOut = async () => {
  try {
    // Clear chat store before signing out
    const userId = (await supabase.auth.getUser()).data.user?.id;
    if (userId) {
      // Remove all chat data for this user
      const keys = Object.keys(localStorage).filter(key => key.startsWith('chat-store') && key.endsWith(userId));
      keys.forEach(key => localStorage.removeItem(key));
      
      // Reset chat store state
      useChatStore.getState().clearAllContexts();
    }

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