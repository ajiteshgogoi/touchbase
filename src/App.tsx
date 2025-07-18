import { useEffect, useState, lazy, Suspense } from 'react';
import { ErrorBoundary } from './components/shared/ErrorBoundary';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { HelmetProvider, Helmet } from 'react-helmet-async';
import { AppLayout } from './components/layout/AppLayout';
import { useStore } from './stores/useStore';
import { supabase } from './lib/supabase/client';
import { setQueryClient } from './utils/queryClient';
import { paymentService } from './services/payment';
import { notificationService } from './services/notifications';
import { platform } from './utils/platform';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { initializeAnalytics } from './lib/firebase'; // Added import

// Eagerly load critical components
import { Login } from './components/auth/Login';
import { AuthCallback } from './components/auth/AuthCallback';
import { LoadingSpinner } from './components/shared/LoadingSpinner';

// Lazy loading component wrapper with error boundary
const LazyComponent = ({ children }: { children: React.ReactNode }) => (
  <ErrorBoundary>
    <Suspense fallback={
      <div className="min-h-screen">
        {/* Empty fallback - components will handle their own loading states */}
      </div>
    }>
      {children}
    </Suspense>
  </ErrorBoundary>
);

// Core components with prefetching
const Dashboard = lazy(() => {
  const module = import('./pages/Dashboard');
  // Prefetch related routes and components while main route loads
  // Removed requestIdleCallback for compatibility
  (async () => {
      void import('./pages/Contacts');
      void import('./pages/Reminders');
      void import('./pages/Settings');
      void import('./pages/Help');
      void import('./pages/ImportantEvents');
      void import('./pages/InteractionHistory');
      void import('./components/contacts/QuickInteraction');
      void import('./components/contacts/ContactForm');
      void import('./components/layout/ProfileMenu'); // Added ProfileMenu prefetch
  })();
  return module.then(m => ({ default: m.Dashboard }));
});

const Contacts = lazy(() => {
  const module = import('./pages/Contacts');
  // Prefetch contact form, interaction modal and history
  // Removed requestIdleCallback for compatibility
  (async () => {
      void import('./components/contacts/ContactForm');
      void import('./pages/InteractionHistory');
      // Prefetch contact data while loading component
      void queryClient.prefetchQuery({
        queryKey: ['contacts'],
        queryFn: () => import('./services/contacts').then(m => m.contactsService.getContacts()),
        staleTime: 1000 * 60 * 5 // 5 minutes
      });
  })();
  return module.then(m => ({ default: m.Contacts }));
});

const Settings = lazy(() => {
  const module = import('./pages/Settings');
  // Removed requestIdleCallback for compatibility
  (async () => {
      void import('./components/shared/FeedbackModal');
      void import('./components/shared/PaymentMethodModal');
      void import('./pages/Terms');
      void import('./pages/Privacy');
  })();
  return module.then(m => ({ default: m.Settings }));
});

// Core routes with prefetching
const Reminders = lazy(() => {
  const module = import('./pages/Reminders');
  // Prefetch quick reminder modal, interaction history and data
  // Removed requestIdleCallback for compatibility
  (async () => {
      void import('./components/reminders/QuickReminderModal');
      void import('./pages/InteractionHistory');
      void import('./pages/Contacts');
      void queryClient.prefetchQuery({
        queryKey: ['reminders'],
        queryFn: () => import('./services/contacts')
          .then(m => m.contactsService.getReminders()),
        staleTime: 1000 * 60 * 5 // 5 minutes
      });
  })();
  return module.then(m => ({ default: m.Reminders }));
});

// Other lazy loaded components
const Help = lazy(() => {
  const module = import('./pages/Help');
  // Removed requestIdleCallback for compatibility
  (async () => {
      void import('./pages/Terms');
      void import('./pages/Privacy');
  })();
  return module.then(m => ({ default: m.Help }));
});

const Analytics = lazy(() => {
  const module = import('./pages/Analytics');
  // Removed requestIdleCallback for compatibility
  (async () => {
      void import('./pages/Contacts');
  })();
  return module.then(m => ({ default: m.Analytics }));
});

const ConversationPrompts = lazy(async () => {
  const module = await import('./pages/ConversationPrompts');
  return { default: module.default };
});

const Terms = lazy(() => {
  const module = import('./pages/Terms');
  // Removed requestIdleCallback for compatibility
  (async () => {
      void import('./pages/Privacy');
      void import('./pages/Support');
  })();
  return module.then(m => ({ default: m.Terms }));
});

const Privacy = lazy(() => {
  const module = import('./pages/Privacy');
  // Removed requestIdleCallback for compatibility
  (async () => {
      void import('./pages/Terms');
      void import('./pages/Support');
  })();
  return module.then(m => ({ default: m.Privacy }));
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

const ImportantEvents = lazy(() => {
  const module = import('./pages/ImportantEvents');
  // Removed requestIdleCallback for compatibility
  (async () => {
      // Prefetch important events data
      void queryClient.prefetchQuery({
        queryKey: ['important-events'],
        queryFn: () => import('./services/contacts')
          .then(m => m.contactsService.getImportantEvents()),
        staleTime: 1000 * 60 * 5 // 5 minutes
      });
  })();
  return module.then(m => ({ default: m.ImportantEventsPage }));
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
  const [hasTimedOut, setHasTimedOut] = useState(false);
  
  useEffect(() => {
    // Only set up timeout during initial load
    if (!isInitialLoad) {
      return () => {}; // Return empty cleanup for non-initial loads
    }

    const timeoutId = setTimeout(() => {
      if (isLoading) {
        console.warn('Auth check timed out after 10 seconds');
        setHasTimedOut(true);
        setIsInitialLoad(false);
      }
    }, 10000); // 10 second timeout

    return () => clearTimeout(timeoutId);
  }, [isInitialLoad, isLoading]);

  useEffect(() => {
    if (!isLoading) {
      setIsInitialLoad(false);
    }
  }, [isLoading]);

  // Handle timeout case
  if (hasTimedOut) {
    localStorage.clear(); // Clear any stale auth state
    
    return (
      <div className="flex flex-col items-center justify-center min-h-[600px] gap-4">
        <div className="text-gray-700 text-lg">
          Authentication is taking longer than expected
        </div>
        <div className="text-gray-600">
          Redirecting to login page...
        </div>
        <div className="mt-2">
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-primary-500 text-white rounded hover:bg-primary-600"
          >
            Retry Now
          </button>
        </div>
        <Navigate to="/login" state={{ from: location }} />
      </div>
    );
  }

  if (isLoading || isInitialLoad) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-center min-h-[600px]">
          <LoadingSpinner />
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
  const { setUser, setIsLoading, setIsPremium, setTrialStatus, setPreferences } = useStore();

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
     console.log('[Preferences] Fetching preferences for user:', userId);
     const { data: prefs } = await supabase
       .from('user_preferences')
       .select('*')
       .eq('user_id', userId)
       .single();

     console.log('[Preferences] Fetched preferences:', prefs);

     if (prefs) {
       // Set preferences in store
       setPreferences(prefs);
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
                
                // Check if any FCM token exists for this device using RPC function
                console.log('[Notifications] Checking existing device subscriptions...');
                const { data: subscriptions } = await supabase
                                  .rpc('get_device_subscription', {
                                    p_user_id: userId,
                                    p_device_id: deviceId,
                                    p_browser_instance: platform.browserInstanceId
                                  });
                
                                console.log('[Notifications] Device subscription check result:', subscriptions);
                                
                                if (!subscriptions?.[0]?.fcm_token) {
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

    // Analytics initialization moved to after initial auth check
    // Initialize auth state //
    const initializeAuth = async () => {
      try {
        setIsLoading(true);
        const { data: { session } } = await supabase.auth.getSession();

        // Initialize analytics after getting session, regardless of auth state
        initializeAnalytics().catch((error: any) => {
          console.error('Error initializing analytics during auth init:', error);
        });

        if (!mounted) return;

        // Check premium status first if user exists
        if (session?.user) {
          await checkPremiumStatus();
          await checkNotificationsAndTimezone(session.user.id);

          // Set User ID in Analytics for authenticated sessions
          // Removed requestIdleCallback for compatibility
          (async () => {
            try {
              const { initializeAnalytics } = await import('./lib/firebase');
              const analytics = await initializeAnalytics(); // Ensure analytics is initialized
                const { setUserId } = await import('firebase/analytics');
                setUserId(analytics, session.user.id);
                console.log('[Analytics] User ID set:', session.user.id.substring(0, 8));
              } catch (error) {
                console.error('Error setting analytics user ID:', error);
              }
          })();

        } else {
          // User is not authenticated
          setIsPremium(false);
          // Clear User ID for anonymous sessions
          // Removed requestIdleCallback for compatibility
          (async () => {
            try {
              const { initializeAnalytics } = await import('./lib/firebase');
              const analytics = await initializeAnalytics(); // Ensure analytics is initialized
                const { setUserId } = await import('firebase/analytics');
                setUserId(analytics, null);
                console.log('[Analytics] User ID cleared for anonymous session.');
              } catch (error) {
                console.error('Error clearing analytics user ID:', error);
              }
          })();
        }

        // Set user after premium status is checked
        setUser(session?.user ?? null);
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

        // Initialize analytics on auth state change
        initializeAnalytics().catch((error: any) => {
          console.error('Error initializing analytics on auth change:', error);
        });

        // Update user state immediately
        setUser(session?.user ?? null);

        // Handle user state changes and set/clear analytics user ID
        if (session?.user) {
          checkNotificationsAndTimezone(session.user.id);
          checkPremiumStatus();
          // Set User ID on auth state change
          // Removed requestIdleCallback for compatibility
          (async () => {
            try {
              const { initializeAnalytics } = await import('./lib/firebase');
              const analytics = await initializeAnalytics();
                const { setUserId } = await import('firebase/analytics');
                setUserId(analytics, session.user.id);
                console.log('[Analytics] User ID set on auth change:', session.user.id.substring(0, 8));
              } catch (error) {
                console.error('Error setting analytics user ID on auth change:', error);
              }
          })();
        } else {
          setIsPremium(false);
          // Clear User ID on sign out
          // Removed requestIdleCallback for compatibility
          (async () => {
            try {
              const { initializeAnalytics } = await import('./lib/firebase');
              const analytics = await initializeAnalytics();
                const { setUserId } = await import('firebase/analytics');
                setUserId(analytics, null);
                console.log('[Analytics] User ID cleared on auth change (sign out).');
              } catch (error) {
                console.error('Error clearing analytics user ID on auth change:', error);
              }
          })();
        }
      }
    );

    // Initialize auth immediately
    initializeAuth();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [setUser, setIsLoading, setIsPremium, setTrialStatus, setPreferences]); // Added potentially missing dependencies

  return (
    <ErrorBoundary
      fallback={
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
      }
    >
      <HelmetProvider>
        <QueryClientProvider client={queryClient}>
          <Helmet>
            <link 
              rel="preload"
              href="/icon.svg"
              as="image"
              type="image/svg+xml"
              fetchPriority="high"
            />
            <link 
              rel="preconnect" 
              href="https://touchbase.site"
              crossOrigin="anonymous"
            />
            <link
              rel="preconnect"
              href="https://api.touchbase.site"
              crossOrigin="anonymous"
            />
            <link
              rel="preconnect"
              href="https://oauth.touchbase.site"
              crossOrigin="anonymous"
            />
          </Helmet>
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
            <AppLayout>
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

            <Route
              path="/quick-interaction/:contactId"
              element={
                <AuthenticatedRoute>
                  <LazyComponent>
                    {/* QuickInteraction will be loaded via modal, but route exists for deep linking */}
                    <Navigate to="/contacts" replace />
                  </LazyComponent>
                </AuthenticatedRoute>
              }
            />

            <Route
              path="/quick-reminder"
              element={
                <AuthenticatedRoute>
                  <LazyComponent>
                    {/* QuickReminder will be loaded via modal, but route exists for deep linking */}
                    <Navigate to="/reminders" replace />
                  </LazyComponent>
                </AuthenticatedRoute>
              }
            />

              {/* Catch all route */}
              <Route path="*" element={<Navigate to="/" />} />
              </Routes>
            </AppLayout>
          </BrowserRouter>
        </QueryClientProvider>
      </HelmetProvider>
    </ErrorBoundary>
  );
}

export default App;
