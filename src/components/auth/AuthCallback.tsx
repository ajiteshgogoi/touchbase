import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../stores/useStore';
import { handleCallback } from '../../lib/auth/google';

export const AuthCallback = () => {
  const navigate = useNavigate();
  const { setUser, setIsLoading } = useStore();

  useEffect(() => {
    const handleAuthCallback = async () => {
      setIsLoading(true);
      try {
        // Get tokens from URL fragment
        const params = new URLSearchParams(window.location.hash.substring(1));
        const idToken = params.get('id_token');
        
        if (!idToken) {
          throw new Error('No ID token received from Google');
        }

        const { session } = await handleCallback(idToken);

        if (session?.user) {
          setUser(session.user);
          navigate('/', { replace: true });
        } else {
          throw new Error('No user session found after authentication');
        }
      } catch (error) {
        console.error('Auth callback error:', error);
        navigate('/login', { replace: true });
      } finally {
        setIsLoading(false);
      }
    };

    handleAuthCallback();
  }, [navigate, setUser, setIsLoading]);

  return (
    <div className="fixed inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="flex flex-col items-center gap-4">
        <svg
          className="animate-spin h-12 w-12 text-primary-500"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
        <span className="text-lg text-gray-600">Completing sign in...</span>
      </div>
    </div>
  );
};

export default AuthCallback;