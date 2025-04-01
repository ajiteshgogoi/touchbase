import { supabase } from '../supabase/client';

export function initiateGoogleLogin() {
  const params = new URLSearchParams({
    client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
    redirect_uri: `${import.meta.env.VITE_APP_URL}/auth/callback`,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    state: crypto.randomUUID(),
    prompt: 'consent'
  });

  window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export async function handleCallback(code: string) {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const workerApiKey = import.meta.env.VITE_WORKER_API_KEY;

  if (!clientId || !workerApiKey) {
    console.error('Missing required environment variables:',
      !clientId ? 'VITE_GOOGLE_CLIENT_ID' : '',
      !workerApiKey ? 'VITE_WORKER_API_KEY' : ''
    );
    throw new Error('OAuth configuration is incomplete. Check environment variables.');
  }

  try {
    // Exchange code through our secure worker
    const tokenResponse = await fetch('https://touchbase-oauth.ajiteshgogoi.workers.dev', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': workerApiKey
      },
      body: JSON.stringify({
        code,
        redirect_uri: `${import.meta.env.VITE_APP_URL}/auth/callback`
      })
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      console.error('Token exchange failed:', error);
      throw new Error(`Failed to exchange code: ${error}`);
    }

    const tokens = await tokenResponse.json();
    console.log('Token exchange successful');
    const { id_token } = tokens;

    if (!id_token) {
      console.error('No ID token in response');
      throw new Error('No ID token received from authentication service');
    }

    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: id_token,
    });

    if (error) {
      console.error('Supabase sign in failed:', error);
      throw error;
    }
    
    console.log('Supabase sign in successful');
    return data;
  } catch (error) {
    console.error('handleCallback error:', error);
    throw error;
  }
}