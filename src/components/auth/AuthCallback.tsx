import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase/client';
import { useStore } from '../../stores/useStore';

export const AuthCallback = () => {
  const navigate = useNavigate();
  const { setUser } = useStore();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        console.log('Auth callback: Getting session...');
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('Auth callback: Session error:', sessionError);
          throw sessionError;
        }
        
        if (session?.user) {
          console.log('Auth callback: Session found, setting user...');
          setUser(session.user);
          // Add a small delay before redirect to ensure state is updated
          setTimeout(() => {
            console.log('Auth callback: Redirecting to home...');
            navigate('/', { replace: true });
          }, 1000);
        } else {
          console.error('Auth callback: No session found');
          setError('No session found');
          setTimeout(() => {
            navigate('/login', { replace: true });
          }, 1000);
        }
      } catch (error) {
        console.error('Auth callback error:', error);
        setError('Authentication failed');
        setTimeout(() => {
          navigate('/login', { replace: true });
        }, 1000);
      } finally {
        setIsLoading(false);
      }
    };

    handleCallback();
  }, [navigate, setUser]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-gray-600">
          Completing sign in...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-red-600">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-pulse text-gray-600">
        Completing sign in...
      </div>
    </div>
  );
};

export default AuthCallback;