import { useEffect, useState, lazy, Suspense } from 'react';
import { ErrorBoundary } from './components/shared/ErrorBoundary';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { SpeedInsights } from "@vercel/speed-insights/react";
import { Layout } from './components/layout/Layout';
import { useStore } from './stores/useStore';
import { supabase } from './lib/supabase/client';
import { paymentService } from './services/payment';
import { notificationService } from './services/notifications';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';

// Eagerly load critical components
import { Login } from './components/auth/Login';
import { AuthCallback } from './components/auth/AuthCallback';
import { LoadingSpinner } from './components/shared/LoadingSpinner';

// Lazy load pages and non-critical components
// Enhanced lazy loading component wrapper with error boundary and preload support
const LazyComponent = ({ children }: { children: React.ReactNode }) => (
  <ErrorBoundary>
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen bg-white">
        <LoadingSpinner />
      </div>
    }>
      {children}
    </Suspense>
  </ErrorBoundary>
);

// Types for module exports
interface LazyModule {
  [key: string]: React.ComponentType<any>;
}

// Lazy load a module with type safety
function lazyLoad(
  importFn: () => Promise<LazyModule>,
  exportKey: string = 'default'
): React.LazyExoticComponent<React.ComponentType<any>> {
  return lazy(() =>
    importFn().then(module => {
      const Component = module[exportKey] || module.default;
      if (!Component) {
        throw new Error(`Component not found: ${exportKey}`);
      }
      return { default: Component };
    })
  );
}

// Main route components with optimized chunking
const Dashboard = lazyLoad(() => import('./pages/Dashboard'), 'Dashboard');
const Contacts = lazyLoad(() => import('./pages/Contacts'), 'Contacts');
const Settings = lazyLoad(() => import('./pages/Settings'), 'Settings');
const Reminders = lazyLoad(() => import('./pages/Reminders'), 'Reminders');
const Help = lazyLoad(() => import('./pages/Help'), 'Help');
const Analytics = lazyLoad(() => import('./pages/Analytics'), 'Analytics');
const ConversationPrompts = lazyLoad(() => import('./pages/ConversationPrompts'));
const Terms = lazyLoad(() => import('./pages/Terms'), 'Terms');
const Privacy = lazyLoad(() => import('./pages/Privacy'), 'Privacy');
const ContactForm = lazyLoad(() => import('./components/contacts/ContactForm'), 'ContactForm');
const InteractionHistory = lazyLoad(() => import('./pages/InteractionHistory'), 'InteractionHistory');

// Prefetch utilities
const COMMON_ROUTES = {
  dashboard: () => import('./pages/Dashboard'),
  contacts: () => import('./pages/Contacts'),
  reminders: () => import('./pages/Reminders'),
};

// Start preloading common routes after initial load
useEffect(() => {
  const { user } = useStore.getState();
  let timer: number;
  
  if (user) {
    const prefetchRoutes = () => {
      const prefetchPromises = Object.values(COMMON_ROUTES).map(importFn =>
        importFn().catch(() => undefined)
      );
      return Promise.all(prefetchPromises);
    };
    
    timer = window.setTimeout(() => {
      prefetchRoutes().catch(() => {
        // Silently handle prefetch errors
      });
    }, 1000);
  }
  
  return () => {
    if (timer) window.clearTimeout(timer);
  };
}, []);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
});

const AuthenticatedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isLoading } = useStore();
  const location = useLocation();
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  
  useEffect(() => {
    if (!isLoading) {
      setIsInitialLoad(false);
    }
  }, [isLoading]);

  if (isLoading || isInitialLoad) {
    return (
      <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: 'rgba(255, 255, 255, 0.9)' }}>
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
          <span className="text-lg text-primary-500">Loading...</span>
        </div>
      </div>
    );
  }
  
  if (!user) {
    // Save the attempted location
    return <Navigate to="/login" state={{ from: location }} />;
  }

  return <>{children}</>;
};

function App() {
  const { setUser, setIsLoading, setIsPremium, setTrialStatus } = useStore();

  // Separate premium status check
  const checkPremiumStatus = async () => {
    try {
      const status = await paymentService.getSubscriptionStatus();
      
      // If user is on free plan and has never had a trial, start one
      if (!status.isPremium && !status.isOnTrial && status.trialDaysRemaining === null) {
        try {
          await paymentService.startTrial();
          // Refetch status after starting trial
          const updatedStatus = await paymentService.getSubscriptionStatus();
          setIsPremium(updatedStatus.isPremium);
          setTrialStatus(updatedStatus.isOnTrial, updatedStatus.trialDaysRemaining);
          return;
        } catch (error) {
          console.error('Error starting trial:', error);
        }
      }

      setIsPremium(status.isPremium);
      setTrialStatus(status.isOnTrial, status.trialDaysRemaining);
    } catch (error) {
      console.error('Error checking premium status:', error);
      setIsPremium(false);
    }
  };

  // Separate notifications and timezone check
  const checkNotificationsAndTimezone = async (userId: string) => {
    try {
      // Initialize notification service
      await notificationService.initialize();
      
      // Get current timezone
      const currentTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      
      // Get or create user preferences
      const { data: prefs } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (prefs) {
        // Only update timezone if changed
        if (prefs.timezone !== currentTimezone) {
          await supabase
            .from('user_preferences')
            .update({
              timezone: currentTimezone
            })
            .eq('id', prefs.id);
        }

        // Only handle notifications if user has explicitly enabled them
        if (prefs.notification_enabled) {
          const hasPermission = await notificationService.checkPermission();
          if (hasPermission) {
            try {
              await notificationService.resubscribeIfNeeded(userId);
            } catch (error) {
              console.log('Error checking subscription:', error);
            }
          }
        }
      } else {
        // Create initial preferences with notifications disabled by default
        await supabase
          .from('user_preferences')
          .insert({
            user_id: userId,
            notification_enabled: false,
            timezone: currentTimezone,
            theme: 'light'
          });
      }
    } catch (error) {
      console.error('Error checking notifications and timezone:', error);
    }
  };

  useEffect(() => {
    let mounted = true;

    // Initialize auth state
    const initializeAuth = async () => {
      try {
        setIsLoading(true);
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!mounted) return;
        
        // Set user immediately
        setUser(session?.user ?? null);
        
        // Check premium status in background if user exists
        if (session?.user) {
          checkPremiumStatus();
          checkNotificationsAndTimezone(session.user.id);
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
        if (mounted) {
          setUser(null);
          setIsPremium(false);
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, session: Session | null) => {
        if (!mounted) return;

        console.log('Auth state changed:', event);
        
        // Update user state immediately
        setUser(session?.user ?? null);

        // Handle user state changes
        if (session?.user) {
          // Only check notifications on subsequent status checks, not immediately after sign in
          if (event !== 'SIGNED_IN') {
            checkNotificationsAndTimezone(session.user.id);
          }
          checkPremiumStatus();
        } else {
          setIsPremium(false);
        }
      }
    );

    // Initialize auth immediately
    initializeAuth();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [setUser, setIsLoading, setIsPremium]);

  return (
    <ErrorBoundary fallback={
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-white">
        <div className="text-2xl font-semibold text-gray-900 mb-4">Application Error</div>
        <div className="text-base text-gray-600 mb-6 text-center max-w-md">
          An unexpected error occurred while loading the application. This might be due to network issues or a problem with loading required resources.
        </div>
        <div className="flex gap-4">
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
          >
            Retry Loading
          </button>
          <button
            onClick={() => {
              localStorage.clear();
              window.location.href = '/login';
            }}
            className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Reset & Login
          </button>
        </div>
      </div>
    }>
      <QueryClientProvider client={queryClient}>
        <SpeedInsights />
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3000,
            style: {
              background: '#333',
              color: '#fff',
            },
          }}
        />
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Layout>
            <Routes>
              {/* Public Routes */}
              <Route path="/login" element={<Login />} />
              <Route path="/auth/callback" element={<AuthCallback />} />
              <Route path="/terms" element={<LazyComponent><Terms /></LazyComponent>} />
              <Route path="/privacy" element={<LazyComponent><Privacy /></LazyComponent>} />

              {/* Protected Routes */}
              <Route
                path="/"
                element={
                  <AuthenticatedRoute>
                    <LazyComponent>
                      <Dashboard />
                    </LazyComponent>
                  </AuthenticatedRoute>
                }
              />

              <Route
                path="/contacts"
                element={
                  <AuthenticatedRoute>
                    <LazyComponent>
                      <Contacts />
                    </LazyComponent>
                  </AuthenticatedRoute>
                }
              />

              <Route
                path="/contacts/new"
                element={
                  <AuthenticatedRoute>
                    <LazyComponent>
                      <ContactForm />
                    </LazyComponent>
                  </AuthenticatedRoute>
                }
              />

              <Route
                path="/contacts/:id/edit"
                element={
                  <AuthenticatedRoute>
                    <LazyComponent>
                      <ContactForm />
                    </LazyComponent>
                  </AuthenticatedRoute>
                }
              />

              <Route
                path="/contacts/:contactId/interactions"
                element={
                  <AuthenticatedRoute>
                    <LazyComponent>
                      <InteractionHistory />
                    </LazyComponent>
                  </AuthenticatedRoute>
                }
              />

              <Route
                path="/analytics"
                element={
                  <AuthenticatedRoute>
                    <LazyComponent>
                      <Analytics />
                    </LazyComponent>
                  </AuthenticatedRoute>
                }
              />

              <Route
                path="/reminders"
                element={
                  <AuthenticatedRoute>
                    <LazyComponent>
                      <Reminders />
                    </LazyComponent>
                  </AuthenticatedRoute>
                }
              />
              <Route
                path="/settings"
                element={
                  <AuthenticatedRoute>
                    <LazyComponent>
                      <Settings />
                    </LazyComponent>
                  </AuthenticatedRoute>
                }
              />

              <Route
                path="/help"
                element={
                  <AuthenticatedRoute>
                    <LazyComponent>
                      <Help />
                    </LazyComponent>
                  </AuthenticatedRoute>
                }
              />

              <Route
                path="/conversation-prompts"
                element={
                  <AuthenticatedRoute>
                    <LazyComponent>
                      <ConversationPrompts />
                    </LazyComponent>
                  </AuthenticatedRoute>
                }
              />

              {/* Catch all route */}
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </Layout>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
