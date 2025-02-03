import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase/client';
import { useStore } from '../../stores/useStore';

export const AuthCallback = () => {
  const navigate = useNavigate();
  const { setUser, setIsLoading } = useStore();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        setIsLoading(true);
        // Get the URL hash if present
        const hash = window.location.hash;
        
        // First try to exchange the auth code for a session
        const { data: { session }, error: authError } = await supabase.auth.getSession();
        
        if (authError) {
          console.error('Auth error:', authError);
          throw authError;
        }
        
        if (!session?.user) {
          throw new Error('No user in session');
        }
        
        // Successfully authenticated
        console.log('Auth successful, setting user');
        setUser(session.user);
        
        // Clear the hash if present
        if (hash) {
          window.location.hash = '';
        }
        
        // Navigate to home
        navigate('/', { replace: true });
      } catch (error) {
        console.error('Auth callback error:', error);
        // On error, clear any partial auth state
        setUser(null);
        navigate('/login', { replace: true });
      } finally {
        setIsLoading(false);
      }
    };

    // Only run if we're not already authenticated
    if (!useStore.getState().user) {
      handleCallback();
    } else {
      navigate('/', { replace: true });
    }
  }, [navigate, setUser, setIsLoading]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-pulse text-gray-600">
        Completing sign in...
      </div>
    </div>
  );
};

export default AuthCallback;