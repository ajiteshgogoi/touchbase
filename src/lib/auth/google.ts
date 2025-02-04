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
  // Exchange code for tokens
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      code,
      client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
      client_secret: import.meta.env.VITE_GOOGLE_CLIENT_SECRET,
      redirect_uri: `${import.meta.env.VITE_APP_URL}/auth/callback`,
      grant_type: 'authorization_code',
    }),
  });

  if (!tokenResponse.ok) {
    const error = await tokenResponse.text();
    throw new Error(`Failed to exchange code: ${error}`);
  }

  const tokens = await tokenResponse.json();
  const { id_token } = tokens;

  if (!id_token) {
    throw new Error('No ID token received from Google');
  }

  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'google',
    token: id_token,
  });

  if (error) throw error;
  return data;
}