import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithGoogle } from '../../lib/supabase/client';
import { useStore } from '../../stores/useStore';

export const Login = () => {
  const navigate = useNavigate();
  const { user, setUser } = useStore();

  useEffect(() => {
    if (user) {
      navigate('/', { replace: true });
    }
  }, [user, navigate]);

  const handleGoogleLogin = async () => {
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error('Error signing in with Google:', error);
    }
  };

  const handleDevLogin = () => {
    if (import.meta.env.DEV) {
      setUser({
        id: 'dev-user',
        email: 'dev@example.com',
        user_metadata: {
          name: 'Dev User',
        },
      });
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center bg-gradient-to-br from-primary-50 to-white">
      <div className="max-w-md w-full p-8 bg-white/80 backdrop-blur-sm rounded-xl shadow-soft">
        <div className="text-center space-y-3">
          <h2 className="text-3xl font-bold bg-gradient-to-r from-primary-600 to-primary-400 bg-clip-text text-transparent">
            Welcome to TouchBase
          </h2>
          <p className="text-gray-600">
            Nurture your relationships, strengthen your connections
          </p>
        </div>

        <div className="mt-10 space-y-6">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white/80 text-gray-500">Sign in with</span>
            </div>
          </div>

          <button
            onClick={handleGoogleLogin}
            className="w-full flex items-center justify-center px-6 py-3 border border-gray-200 rounded-lg text-base font-medium text-gray-700 bg-white hover:bg-primary-50 hover:border-primary-100 transition-all duration-200 shadow-soft hover:shadow-lg"
          >
            <svg
              className="h-5 w-5 mr-3"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Continue with Google
          </button>

          {import.meta.env.DEV && (
            <button
              onClick={handleDevLogin}
              className="w-full px-6 py-3 text-sm font-medium text-white bg-primary-500 hover:bg-primary-400 rounded-lg transition-all duration-200 shadow-soft hover:shadow-lg"
            >
              Development Mode Login
            </button>
          )}
        </div>

        <div className="mt-8 text-center">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200"></div>
            </div>
            <div className="relative flex flex-col items-center">
              <span className="px-4 bg-white/80 text-gray-500 text-sm">
                By continuing, you agree to our
              </span>
              <div className="mt-2 space-x-1 text-sm">
                <a href="#" className="text-primary-500 hover:text-primary-400 font-medium">
                  Terms of Service
                </a>
                <span className="text-gray-500">and</span>
                <a href="#" className="text-primary-500 hover:text-primary-400 font-medium">
                  Privacy Policy
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;