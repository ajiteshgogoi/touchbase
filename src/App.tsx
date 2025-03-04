import { useEffect, useState, lazy, Suspense } from 'react';
import { ErrorBoundary } from './components/shared/ErrorBoundary';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { SpeedInsights } from "@vercel/speed-insights/react";
import { Layout } from './components/layout/Layout';
import { useStore } from './stores/useStore';
import { supabase } from './lib/supabase/client';
import { setQueryClient } from './utils/queryClient';
import { paymentService } from './services/payment';
import { notificationService } from './services/notifications';
import { platform } from './utils/platform';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';

// Eagerly load critical components
import { Login } from './components/auth/Login';
import { AuthCallback } from './components/auth/AuthCallback';
import { LoadingSpinner } from './components/shared/LoadingSpinner';

// Lazy load pages and non-critical components
// Lazy loading component wrapper with error boundary
const LazyComponent = ({ children }: { children: React.ReactNode }) => (
  <ErrorBoundary>
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner />
      </div>
    }>
      {children}
    </Suspense>
  </ErrorBoundary>
);

// Lazy loaded components with async imports
const Dashboard = lazy(async () => {
  const module = await import('./pages/Dashboard');
  return { default: module.Dashboard };
});

const Contacts = lazy(async () => {
  const module = await import('./pages/Contacts');
  return { default: module.Contacts };
});

const Settings = lazy(async () => {
  const module = await import('./pages/Settings');
  return { default: module.Settings };
});

const Reminders = lazy(async () => {
  const module = await import('./pages/Reminders');
  return { default: module.Reminders };
});

const Help = lazy(async () => {
  const module = await import('./pages/Help');
  return { default: module.Help };
});

const Analytics = lazy(async () => {
  const module = await import('./pages/Analytics');
  return { default: module.Analytics };
});

const ConversationPrompts = lazy(async () => {
  const module = await import('./pages/ConversationPrompts');
  return { default: module.default };
});

const Terms = lazy(async () => {
  const module = await import('./pages/Terms');
  return { default: module.Terms };
});

const Privacy = lazy(async () => {
  const module = await import('./pages/Privacy');
  return { default: module.Privacy };
});

const Support = lazy(async () => {
  const module = await import('./pages/Support');
  return { default: module.Support };
});

const ContactForm = lazy(async () => {
  const module = await import('./components/contacts/ContactForm');
  return { default: module.ContactForm };
});

const InteractionHistory = lazy(async () => {
  const module = await import('./pages/InteractionHistory');
  return { default: module.InteractionHistory };
});

const ImportantEvents = lazy(async () => {
  const module = await import('./pages/ImportantEvents');
  return { default: module.ImportantEventsPage };
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
});

setQueryClient(queryClient);

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

  // Check notifications and timezone settings
  const checkNotificationsAndTimezone = async (userId: string) => {
    try {
      // Initialize notification service
      await notificationService.initialize();
      
      // Get current timezone and device notification state
      const currentTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const hasPermission = await notificationService.checkPermission();
      
      // Get or create user preferences
      const { data: prefs } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (prefs) {
        // Update timezone if changed
        const updates: { timezone?: string; notification_enabled?: boolean } = {};
        if (prefs.timezone !== currentTimezone) {
          updates.timezone = currentTimezone;
        }

        // Handle notification states
        if (prefs.notification_enabled) {
          if (!hasPermission) {
            // If browser permission denied, disable globally
            updates.notification_enabled = false;
          } else {
            // If browser permission granted and global notifications on,
            // ensure device is subscribed
            try {
              console.log('[Notifications] Checking device notification state...');
              const deviceInfo = platform.getDeviceInfo();
              console.log('[Notifications] Device info:', deviceInfo);
              
              const deviceId = deviceInfo.deviceType === 'android' || deviceInfo.deviceType === 'ios'
                ? sessionStorage.getItem('mobile_fcm_device_id')
                : localStorage.getItem(platform.getDeviceStorageKey('device_id'));

              if (deviceId) {
                console.log('[Notifications] Found device ID:', deviceId);
                
                // Check if any FCM token exists for this device
                console.log('[Notifications] Checking existing device subscriptions...');
                const { data: subscription } = await supabase
                  .from('push_subscriptions')
                  .select('fcm_token')
                  .eq('user_id', userId)
                  .eq('device_id', deviceId)
                  .limit(1)
                  .single();

                console.log('[Notifications] Device subscription check result:', subscription);
                
                if (!subscription?.fcm_token) {
                  console.log('[Notifications] No FCM token found for device, creating new subscription...');
                  await notificationService.subscribeToPushNotifications(userId);
                  console.log('[Notifications] New subscription created successfully');
                } else {
                  console.log('[Notifications] Active subscription exists for device, skipping creation');
                }
              } else {
                console.log('[Notifications] No device ID found, creating first-time subscription...');
                await notificationService.subscribeToPushNotifications(userId);
                console.log('[Notifications] First-time subscription created successfully');
              }
            } catch (error) {
              console.error('[Notifications] Error handling device notification state:', error);
            }
          }
        }

        // Apply updates if any
        if (Object.keys(updates).length > 0) {
          await supabase
            .from('user_preferences')
            .update(updates)
            .eq('id', prefs.id);
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

        // Ensure device state is synced
        await notificationService.toggleDeviceNotifications(userId, localStorage.getItem(platform.getDeviceStorageKey('device_id'))!, false);
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
          checkNotificationsAndTimezone(session.user.id);
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
              <Route path="/support" element={<LazyComponent><Support /></LazyComponent>} />

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

              <Route
                path="/important-events"
                element={
                  <AuthenticatedRoute>
                    <LazyComponent>
                      <ImportantEvents />
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
