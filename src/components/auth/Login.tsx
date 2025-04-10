// External imports
import { useEffect, useState, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import type { User } from '@supabase/supabase-js';

// Internal imports
import { GoogleIcon, InstagramIcon, RedditIcon, LinkedInIcon, YoutubeIcon } from './icons/AuthIcons';
import { ErrorBoundary } from '../shared/ErrorBoundary';
import { LoadingSpinner } from '../shared/LoadingSpinner';
import { UsersSocialProof } from './UsersSocialProof';
import { useStore } from '../../stores/useStore';
import { initiateGoogleLogin } from '../../lib/auth/google';

const InstallModal = lazy(() => import('./InstallModal'));

// Lazy loading component wrapper with error boundary
const LazyComponent = ({ children }: { children: React.ReactNode }) => (
  <ErrorBoundary>
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[50vh]">
        <LoadingSpinner />
      </div>
    }>
      {children}
    </Suspense>
  </ErrorBoundary>
);

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
      <Helmet>
        <link rel="canonical" href="https://touchbase.site" />
        <link rel="preconnect" href="https://accounts.google.com" />
        <link rel="preconnect" href="https://oauth2.googleapis.com" />
        <link rel="preconnect" href="https://www.googleapis.com" />
      </Helmet>
      <main role="main" className="min-h-[80vh] flex flex-col items-center justify-center space-y-8 px-4 py-16">
        <div className="text-center space-y-5 max-w-xl">
          <h1 className="text-4xl sm:text-5xl font-[650] bg-gradient-to-r from-primary-600/90 to-primary-400/90 dark:from-primary-500 dark:to-primary-300 bg-clip-text text-transparent tracking-[-0.02em]">
            Welcome to TouchBase
          </h1>
          <p className="text-xl sm:text-2xl text-gray-600/90 dark:text-gray-400 font-[450] tracking-[-0.01em]">
            Stay connected with the people who matter most
          </p>
        </div>

        <div className="max-w-4xl w-full px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
            <div className="p-6 rounded-2xl bg-white/60 dark:bg-gray-900/60 backdrop-blur-md border border-gray-100/50 dark:border-gray-800/50 shadow-sm dark:shadow-sm hover:shadow-md dark:hover:shadow-lg transition-all duration-300">
              <div className="text-primary-500/90 mb-3">
                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-7 w-7" aria-hidden="true" focusable="false">
                  <path d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" strokeWidth="1.5"/>
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-700/90 dark:text-gray-100 mb-2">Simple & Personal</h3>
              <p className="text-gray-600/90 dark:text-gray-400 leading-relaxed">Track important interactions with your loved ones in one space</p>
            </div>
            
            <div className="p-6 rounded-2xl bg-white/60 dark:bg-gray-900/60 backdrop-blur-md border border-gray-100/50 dark:border-gray-800/50 shadow-sm dark:shadow-sm hover:shadow-md dark:hover:shadow-lg transition-all duration-300">
              <div className="text-primary-500/90 mb-3">
                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-7 w-7" aria-hidden="true" focusable="false">
                  <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" strokeWidth="1.5"/>
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-700/90 dark:text-gray-100 mb-2">Timely Reminders</h3>
              <p className="text-gray-600/90 dark:text-gray-400 leading-relaxed">Get gentle nudges to reconnect before life gets in the way</p>
            </div>
            
            <div className="p-6 rounded-2xl bg-white/60 dark:bg-gray-900/60 backdrop-blur-md border border-gray-100/50 dark:border-gray-800/50 shadow-sm dark:shadow-sm hover:shadow-md dark:hover:shadow-lg transition-all duration-300">
              <div className="text-primary-500/90 mb-3">
                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-7 w-7" aria-hidden="true" focusable="false">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" strokeWidth="1.5"/>
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-700/90 dark:text-gray-100 mb-2">Helpful Assistant</h3>
              <p className="text-gray-600/90 dark:text-gray-400 leading-relaxed">Personalised suggestions to make every conversation meaningful</p>
            </div>
          </div>
        </div>

        <div className="max-w-lg text-center px-6 py-4 rounded-2xl bg-gray-50/90 dark:bg-gray-900/60 backdrop-blur-sm border border-gray-100/50 dark:border-gray-800/50">
          <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 sm:h-7 sm:w-7 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true" focusable="false">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
            <p className="text-base text-gray-600/90 dark:text-gray-400 leading-relaxed text-center">
              TouchBase is your private space for nurturing real-world relationships. It is not a social network.
            </p>
          </div>
        </div>

        <div className="bg-white/70 dark:bg-gray-900/60 backdrop-blur-xl px-10 pt-6 pb-10 rounded-2xl border border-gray-100/50 dark:border-gray-800/50 shadow-lg max-w-sm w-full hover:shadow-xl hover:bg-white/80 dark:hover:bg-gray-900/70 transition-all duration-200">
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
              className="w-full h-[52px] flex items-center justify-center px-8 rounded-xl text-base font-[500] text-white bg-primary-500 dark:bg-primary-600 hover:bg-primary-600 dark:hover:bg-primary-700 shadow-md hover:shadow-lg active:scale-[0.99] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
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
                  <GoogleIcon className="h-5 w-5 mr-3" />
                  <span className="hidden sm:inline">Sign in with Google</span>
                  <span className="sm:hidden">Sign in</span>
                </>
              )}
            </button>

            {import.meta.env.DEV && (
              <button
                onClick={handleDevLogin}
                className="w-full px-6 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900 hover:bg-primary-50 dark:hover:bg-primary-900/50 hover:border-primary-100 dark:hover:border-primary-800 rounded-xl transition-all duration-200 shadow-md hover:shadow-lg active:scale-[0.98]"
              >
                Development Mode Login
              </button>
            )}
          </div>

          <p className="text-[14px] text-gray-500/90 dark:text-gray-400 text-center mt-10 leading-[1.5] tracking-[-0.01em]">
            By continuing, you agree to our{' '}
            <a href="/terms" className="text-primary-500 hover:text-primary-600 dark:text-primary-400 dark:hover:text-primary-300 font-medium">
              Terms of Service
            </a>{' '}
            and{' '}
            <a href="/privacy" className="text-primary-500 hover:text-primary-600 dark:text-primary-400 dark:hover:text-primary-300 font-medium">
              Privacy Policy
            </a>
          </p>
        </div>

        <button
          onClick={() => setIsInstallModalOpen(true)}
          className="flex flex-col sm:flex-row items-center gap-3 text-center sm:text-left text-[14px] text-gray-600/90 dark:text-gray-400 bg-white/60 dark:bg-gray-900/60 backdrop-blur-sm px-7 py-4 rounded-xl border border-gray-100/50 dark:border-gray-800/50 shadow-sm dark:shadow-sm hover:shadow-md dark:hover:shadow-lg hover:bg-white/70 dark:hover:bg-gray-900/70 transition-all duration-200"
        >
          <img src="/icon.svg" alt="heart" className="w-5 h-5 text-primary-500" loading="eager" />
          <span>Get TouchBase on your device</span>
        </button>

        <div className="flex items-center gap-6">
          <a
            href="https://www.instagram.com/touchbase.site"
            target="_blank"
            rel="preconnect noopener noreferrer"
            className="text-gray-500 hover:text-gray-600 dark:text-gray-400 dark:hover:text-gray-300 transition-colors duration-200"
            aria-label="Follow us on Instagram"
          >
            <InstagramIcon className="h-4 w-4" />
          </a>
          <a
            href="https://www.reddit.com/r/TouchBase/"
            target="_blank"
            rel="preconnect noopener noreferrer"
            className="text-gray-500 hover:text-gray-600 dark:text-gray-400 dark:hover:text-gray-300 transition-colors duration-200"
            aria-label="Join our Reddit community"
          >
            <RedditIcon className="h-4 w-4" />
          </a>
          <a
            href="https://www.linkedin.com/company/touchbase-site/"
            target="_blank"
            rel="preconnect noopener noreferrer"
            className="text-gray-500 hover:text-gray-600 dark:text-gray-400 dark:hover:text-gray-300 transition-colors duration-200"
            aria-label="Connect with us on LinkedIn"
          >
            <LinkedInIcon className="h-4 w-4" />
          </a>
          <a
            href="https://www.youtube.com/@touchbase-site"
            target="_blank"
            rel="preconnect noopener noreferrer"
            className="text-gray-500 hover:text-gray-600 dark:text-gray-400 dark:hover:text-gray-300 transition-colors duration-200"
            aria-label="Subscribe to our YouTube channel"
          >
            <YoutubeIcon className="h-4 w-4" />
          </a>
        </div>
      </main>

      <LazyComponent>
        <InstallModal
          isOpen={isInstallModalOpen}
          onClose={() => setIsInstallModalOpen(false)}
        />
      </LazyComponent>
    </div>
  );
};

export default Login;
