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
  const clientSecret = import.meta.env.VITE_GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error('Missing required environment variables:',
      !clientId ? 'VITE_GOOGLE_CLIENT_ID' : '',
      !clientSecret ? 'VITE_GOOGLE_CLIENT_SECRET' : ''
    );
    throw new Error('Google OAuth configuration is incomplete. Check environment variables.');
  }

  // Basic auth header for client credentials
  const basicAuth = btoa(`${clientId}:${clientSecret}`);

  // Exchange code for tokens
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${basicAuth}`,
    },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      redirect_uri: `${import.meta.env.VITE_APP_URL}/auth/callback`,
      grant_type: 'authorization_code',
    }),
  });

  // Log credentials being used (without the secret)
  console.log('Using client ID:', clientId);
  console.log('Redirect URI:', `${import.meta.env.VITE_APP_URL}/auth/callback`);

  try {
    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      console.error('Token exchange failed:', error);
      throw new Error(`Failed to exchange code: ${error}`);
    }

    const tokens = await tokenResponse.json();
    console.log('Token exchange successful:', tokens);
    const { id_token } = tokens;

    if (!id_token) {
      console.error('No ID token in response:', tokens);
      throw new Error('No ID token received from Google');
    }

    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: id_token,
    });

    if (error) {
      console.error('Supabase sign in failed:', error);
      throw error;
    }
    console.log('Supabase sign in successful:', data);
    return data;
  } catch (error) {
    console.error('handleCallback error:', error);
    throw error;
  }
}