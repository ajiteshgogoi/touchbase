import { supabase } from '../supabase/client';

export function initiateGoogleLogin() {
  const params = new URLSearchParams({
    client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
    redirect_uri: `${import.meta.env.VITE_APP_URL}/auth/callback`,
    response_type: 'token id_token',
    scope: 'openid email profile',
    nonce: crypto.randomUUID(),
    prompt: 'select_account',
    state: crypto.randomUUID()
  });

  window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export async function handleCallback(idToken: string) {
  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'google',
    token: idToken,
  });

  if (error) throw error;
  return data;
}