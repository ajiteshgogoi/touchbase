import { useEffect, useState } from 'react';
import { InstallModal } from './InstallModal';
import { UsersSocialProof } from './UsersSocialProof';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../stores/useStore';
import { Helmet } from 'react-helmet-async';
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
      <Helmet>
        <link rel="canonical" href="https://touchbase.site" />
      </Helmet>
      <main role="main" className="min-h-[80vh] flex flex-col items-center justify-center space-y-8 px-4 py-16">
      <div className="text-center space-y-5 max-w-xl">
        <h1 className="text-4xl sm:text-5xl font-[650] bg-gradient-to-r from-primary-600/90 to-primary-400/90 bg-clip-text text-transparent tracking-[-0.02em]">
          Welcome to TouchBase
        </h1>
        <p className="text-xl sm:text-2xl text-gray-600/90 font-[450] tracking-[-0.01em]">
          Stay connected with the people who matter most
        </p>
      </div>

      <div className="max-w-4xl w-full px-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
          <div className="p-6 rounded-2xl bg-white/60 backdrop-blur-md border border-gray-100/50 shadow-sm hover:shadow-md hover:bg-white/70 transition-all duration-300">
            <div className="text-primary-500/90 mb-3">
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-7 w-7" aria-hidden="true" focusable="false">
                <path d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" strokeWidth="1.5"/>
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-800/90 mb-2">Simple & Personal</h3>
            <p className="text-gray-600/90 leading-relaxed">Track important interactions with your loved ones in one space</p>
          </div>
          
          <div className="p-6 rounded-2xl bg-white/60 backdrop-blur-md border border-gray-100/50 shadow-sm hover:shadow-md hover:bg-white/70 transition-all duration-300">
            <div className="text-primary-500/90 mb-3">
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-7 w-7" aria-hidden="true" focusable="false">
                <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" strokeWidth="1.5"/>
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-800/90 mb-2">Timely Reminders</h3>
            <p className="text-gray-600/90 leading-relaxed">Get gentle nudges to reconnect before life gets in the way</p>
          </div>
          
          <div className="p-6 rounded-2xl bg-white/60 backdrop-blur-md border border-gray-100/50 shadow-sm hover:shadow-md hover:bg-white/70 transition-all duration-300">
            <div className="text-primary-500/90 mb-3">
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-7 w-7" aria-hidden="true" focusable="false">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" strokeWidth="1.5"/>
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-800/90 mb-2">Helpful Assistant</h3>
            <p className="text-gray-600/90 leading-relaxed">Personalised suggestions to make every conversation meaningful</p>
          </div>
        </div>
      </div>

      <div className="max-w-lg text-center px-6 py-4 rounded-2xl bg-gray-50/80 backdrop-blur-sm border border-gray-100/50">
        <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 sm:h-7 sm:w-7 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true" focusable="false">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
          <p className="text-base text-gray-600/90 leading-relaxed text-center">
            TouchBase is your private space for nurturing real-world relationships. It is not a social network.
          </p>
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

      <button
        onClick={() => setIsInstallModalOpen(true)}
        className="flex flex-col sm:flex-row items-center gap-3 text-center sm:text-left text-[14px] text-gray-600 bg-white/60 backdrop-blur-sm px-7 py-4 rounded-xl border border-gray-100/50 shadow-sm hover:bg-white/70 transition-colors duration-200"
      >
        <img src="/icon.svg" alt="heart" className="w-5 h-5 text-primary-500" loading="eager" />
        <span>Get TouchBase on your device</span>
      </button>

      <div className="flex items-center gap-6">
        <a
          href="https://www.instagram.com/touchbase.site"
          target="_blank"
          rel="noopener noreferrer"
          className="text-gray-500 hover:text-gray-600 transition-colors duration-200"
          aria-label="Follow us on Instagram"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            className="h-4 w-4"
            fill="currentColor"
            aria-hidden="true"
            focusable="false"
          >
            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
          </svg>
        </a>
        <a
          href="https://www.reddit.com/r/TouchBase/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-gray-500 hover:text-gray-600 transition-colors duration-200"
          aria-label="Join our Reddit community"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            className="h-4 w-4"
            fill="currentColor"
            aria-hidden="true"
            focusable="false"
          >
            <path d="M24 11.779c0-1.459-1.192-2.645-2.657-2.645-.715 0-1.363.286-1.84.746-1.81-1.191-4.259-1.949-6.971-2.046l1.483-4.669 4.016.941-.006.058c0 1.193.975 2.163 2.174 2.163 1.198 0 2.172-.97 2.172-2.163s-.975-2.164-2.172-2.164c-.92 0-1.704.574-2.021 1.379l-4.329-1.015c-.189-.046-.381.063-.44.249l-1.654 5.207c-2.838.034-5.409.798-7.3 2.025-.474-.438-1.103-.712-1.799-.712-1.465 0-2.656 1.187-2.656 2.646 0 .97.533 1.811 1.317 2.271-.052.282-.086.567-.086.857 0 3.911 4.808 7.093 10.719 7.093s10.72-3.182 10.72-7.093c0-.274-.029-.544-.075-.81.832-.447 1.405-1.312 1.405-2.318zm-17.224 1.816c0-.868.71-1.575 1.582-1.575.872 0 1.581.707 1.581 1.575s-.709 1.574-1.581 1.574-1.582-.706-1.582-1.574zm9.061 4.669c-.797.793-2.048 1.179-3.824 1.179l-.013-.003-.013.003c-1.777 0-3.028-.386-3.824-1.179-.145-.144-.145-.379 0-.523.145-.145.381-.145.526 0 .65.647 1.729.961 3.298.961l.013.003.013-.003c1.569 0 2.648-.315 3.298-.962.145-.145.381-.144.526 0 .145.145.145.379 0 .524zm-.189-3.095c-.872 0-1.581-.706-1.581-1.574 0-.868.709-1.575 1.581-1.575s1.581.707 1.581 1.575-.709 1.574-1.581 1.574z"/>
          </svg>
        </a>
        <a
          href="https://www.linkedin.com/company/touchbase-site/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-gray-500 hover:text-gray-600 transition-colors duration-200"
          aria-label="Connect with us on LinkedIn"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            className="h-4 w-4"
            fill="currentColor"
            aria-hidden="true"
            focusable="false"
          >
            <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
          </svg>
        </a>
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
