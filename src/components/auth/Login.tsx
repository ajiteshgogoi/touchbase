import { useEffect, useState } from 'react';
import { InstallModal } from './InstallModal';
import { UsersSocialProof } from './UsersSocialProof';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../stores/useStore';
import type { User } from '@supabase/supabase-js';
import { initiateGoogleLogin } from '../../lib/auth/google';

export const Login = () => {
  const navigate = useNavigate();
  const { user, setUser } = useStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);

  useEffect(() => {
    if (user) {
      navigate('/', { replace: true });
    }
  }, [user, navigate]);

  const handleGoogleLogin = async () => {
    try {
      setIsLoading(true);
      setError(null);
      console.log('Starting Google sign in...');
      initiateGoogleLogin();
      // Don't set isLoading to false here as we're going to redirect
    } catch (error) {
      console.error('Error signing in with Google:', error);
      setError('Failed to sign in with Google. Please try again.');
      setIsLoading(false);
    }
  };

  const handleDevLogin = () => {
    if (import.meta.env.DEV) {
      const mockUser: User = {
        id: 'dev-user',
        app_metadata: {},
        user_metadata: { name: 'Dev User' },
        aud: 'authenticated',
        created_at: new Date().toISOString(),
        confirmed_at: new Date().toISOString(),
        email: 'dev@example.com',
        email_confirmed_at: new Date().toISOString(),
        phone: undefined,
        last_sign_in_at: new Date().toISOString(),
        role: 'authenticated',
        updated_at: new Date().toISOString()
      };
      setUser(mockUser);
    }
  };

  return (
    <div>
      <main role="main" className="min-h-[80vh] flex flex-col items-center justify-center space-y-10 px-4 py-16">
      <div className="text-center space-y-5 max-w-xl">
        <h2 className="text-4xl sm:text-5xl font-[650] bg-gradient-to-r from-primary-600/90 to-primary-400/90 bg-clip-text text-transparent tracking-[-0.02em]">
          Welcome to TouchBase
        </h2>
        <p className="text-xl sm:text-2xl text-gray-600/90 font-[450] tracking-[-0.01em]">
          Stay connected with the people who matter most
        </p>
      </div>

      <div className="max-w-4xl w-full px-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
          <div className="p-6 rounded-2xl bg-white/60 backdrop-blur-md border border-gray-100/50 shadow-sm hover:shadow-md hover:bg-white/70 transition-all duration-300">
            <div className="text-primary-500/90 mb-3">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true" focusable="false">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-800/90 mb-2">Simple & Personal</h3>
            <p className="text-gray-600/90 leading-relaxed">Track meaningful interactions with your loved ones in one unified space</p>
          </div>
          
          <div className="p-6 rounded-2xl bg-white/60 backdrop-blur-md border border-gray-100/50 shadow-sm hover:shadow-md hover:bg-white/70 transition-all duration-300">
            <div className="text-primary-500/90 mb-3">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true" focusable="false">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-800/90 mb-2">Timely Reminders</h3>
            <p className="text-gray-600/90 leading-relaxed">Get gentle nudges to reconnect before life gets in the way</p>
          </div>
          
          <div className="p-6 rounded-2xl bg-white/60 backdrop-blur-md border border-gray-100/50 shadow-sm hover:shadow-md hover:bg-white/70 transition-all duration-300">
            <div className="text-primary-500/90 mb-3">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true" focusable="false">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-800/90 mb-2">Smart Assistant</h3>
            <p className="text-gray-600/90 leading-relaxed">Get personalized suggestions to make every conversation count</p>
          </div>
        </div>
      </div>

      <div className="bg-white/70 backdrop-blur-xl px-10 pt-6 pb-10 rounded-2xl shadow-lg max-w-sm w-full hover:bg-white/80 transition-colors duration-200">
        {error && (
          <div className="mb-8 p-4 text-[15px] text-red-700 bg-red-50 rounded-xl" role="alert">
            {error}
          </div>
        )}
        <div className="flex flex-col items-center gap-5 w-full">
          <UsersSocialProof />
          
          <button
            onClick={handleGoogleLogin}
            disabled={isLoading}
            className="w-full h-[52px] flex items-center justify-center px-8 rounded-xl text-base font-[500] text-white bg-primary-500 hover:bg-primary-600 shadow-md hover:shadow-lg active:scale-[0.99] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            {isLoading ? (
              <svg
                className="animate-spin h-5 w-5 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                focusable="false"
                aria-label="Loading..."
                role="status"
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
            ) : (
              <>
                <svg
                  className="h-5 w-5 mr-3"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                  focusable="false"
                >
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                <span className="hidden sm:inline">Sign in with Google</span>
                <span className="sm:hidden">Sign in</span>
              </>
            )}
          </button>

          {import.meta.env.DEV && (
            <button
              onClick={handleDevLogin}
              className="w-full px-6 py-3 text-sm font-medium text-gray-700 bg-white hover:bg-primary-50 hover:border-primary-100 rounded-xl transition-all duration-200 shadow-md hover:shadow-lg active:scale-[0.98]"
            >
              Development Mode Login
            </button>
          )}
        </div>

        <p className="text-[14px] text-gray-500/90 text-center mt-10 leading-[1.5] tracking-[-0.01em]">
          By continuing, you agree to our{' '}
          <a href="/terms" className="text-primary-500 hover:text-primary-600 font-medium">
            Terms of Service
          </a>{' '}
          and{' '}
          <a href="/privacy" className="text-primary-500 hover:text-primary-600 font-medium">
            Privacy Policy
          </a>
        </p>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-3 text-center sm:text-left text-[14px] text-gray-600 bg-white/60 backdrop-blur-sm px-7 py-4 rounded-xl border border-gray-100/50 shadow-sm hover:bg-white/70 transition-colors duration-200">
        <img src="/icon.svg" alt="heart" className="w-5 h-5 text-primary-500" />
        <span>
          Install TouchBase on your phone for the best experience.{' '}
          <button
            onClick={() => setIsInstallModalOpen(true)}
            className="text-primary-500 hover:text-primary-600 font-medium"
          >
            Learn how
          </button>
        </span>
      </div>
      </main>

      <InstallModal
        isOpen={isInstallModalOpen}
        onClose={() => setIsInstallModalOpen(false)}
      />
    </div>
  );
};

export default Login;