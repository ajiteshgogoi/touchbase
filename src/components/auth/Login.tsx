import { useEffect, useState } from 'react';
import { InstallModal } from './InstallModal';
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

  // Moving installation prompt near sign-in for better visibility
  const InstallPrompt = () => (
    <div className="text-center mb-6">
      <button
        onClick={() => setIsInstallModalOpen(true)}
        className="group inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-50 hover:bg-primary-100 transition-all duration-300"
      >
        <img src="/icon.svg" alt="heart" className="w-5 h-5 group-hover:scale-110 transition-transform duration-300" />
        <span className="text-sm text-primary-700">
          Install TouchBase for the best experience
        </span>
      </button>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col items-center justify-center py-8 sm:py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background shapes - adjusted positioning and size */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] right-[5%] w-[500px] h-[500px] bg-primary-100/50 rounded-full opacity-20 blur-3xl animate-float"></div>
        <div className="absolute -bottom-[10%] left-[5%] w-[500px] h-[500px] bg-primary-200/50 rounded-full opacity-20 blur-3xl animate-float-delayed"></div>
      </div>

      <div className="relative w-full max-w-5xl mx-auto">
        <div className="text-center space-y-4 sm:space-y-6 mb-8 sm:mb-12">
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold bg-gradient-to-r from-primary-600 via-primary-500 to-primary-400 bg-clip-text text-transparent transition-colors duration-300 px-4">
            Welcome to TouchBase
          </h2>
          <p className="text-xl sm:text-2xl md:text-3xl text-gray-600 font-light px-4">
            Stay connected with the people who matter most
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 mt-8 sm:mt-12 px-4">
            {[
              {
                icon: (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                ),
                title: 'Simple & Personal',
                description: 'Track important interactions with your loved ones in one place'
              },
              {
                icon: (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                ),
                title: 'Timely Reminders',
                description: 'Get gentle nudges to reconnect before life gets in the way'
              },
              {
                icon: (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                ),
                title: 'Helpful Assistant',
                description: 'Personalised suggestions to make every conversation meaningful'
              }
            ].map((feature, idx) => (
              <div
                key={idx}
                className="group p-4 sm:p-6 rounded-2xl bg-white/70 backdrop-blur-lg border border-gray-100/50 shadow-soft hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
              >
                <div className="text-primary-500 mb-4 transition-transform duration-300 group-hover:scale-110">
                  {feature.icon}
                </div>
                <h3 className="text-lg sm:text-xl font-semibold text-gray-800 mb-2">
                  {feature.title}
                </h3>
                <p className="text-sm sm:text-base text-gray-600 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative w-full max-w-sm mx-auto mb-8 sm:mb-12 px-4">
          <InstallPrompt />
          
          <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-xl p-6 sm:p-8 border border-gray-100/50">
            {error && (
              <div className="mb-6 p-4 text-sm text-red-700 bg-red-50 rounded-xl border border-red-100" role="alert">
                {error}
              </div>
            )}
            
            <div className="flex flex-col items-center gap-4">
              <button
                onClick={handleGoogleLogin}
                disabled={isLoading}
                className="w-full h-[52px] sm:h-[60px] flex items-center justify-center gap-3 px-6 sm:px-8 rounded-xl text-base font-medium text-white bg-primary-500 hover:bg-primary-600 shadow-soft hover:shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-0.5 active:translate-y-0"
              >
                {isLoading ? (
                  <svg
                    className="animate-spin h-5 w-5 sm:h-6 sm:w-6 text-white"
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
                ) : (
                  <>
                    <svg className="h-5 w-5 sm:h-6 sm:w-6" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    Sign in with Google
                  </>
                )}
              </button>

              {import.meta.env.DEV && (
                <button
                  onClick={handleDevLogin}
                  className="w-full h-[52px] sm:h-[60px] px-6 sm:px-8 text-base font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-xl transition-all duration-300 shadow-sm hover:shadow active:bg-gray-200"
                >
                  Development Mode Login
                </button>
              )}
            </div>

            <div className="mt-8">
              <div className="text-center">
                <p className="text-sm text-gray-500 leading-relaxed">
                  By continuing, you agree to our{' '}
                  <a href="/terms" className="text-primary-600 hover:text-primary-700 font-medium hover:underline">
                    Terms of Service
                  </a>
                  {' '}and{' '}
                  <a href="/privacy" className="text-primary-600 hover:text-primary-700 font-medium hover:underline">
                    Privacy Policy
                  </a>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <InstallModal
        isOpen={isInstallModalOpen}
        onClose={() => setIsInstallModalOpen(false)}
      />
    </div>
  );
};

export default Login;