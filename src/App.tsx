import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PayPalScriptProvider } from '@paypal/react-paypal-js';
import { Toaster } from 'react-hot-toast';
import { Layout } from './components/layout/Layout';
import { useStore } from './stores/useStore';
import { supabase } from './lib/supabase/client';
import { paymentService } from './services/payment';
import { notificationService } from './services/notifications';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';

// Page Imports
import { Dashboard } from './pages/Dashboard';
import { Contacts } from './pages/Contacts';
import { Settings } from './pages/Settings';
import { Reminders } from './pages/Reminders';
import { Help } from './pages/Help';
import { Login } from './components/auth/Login';
import { AuthCallback } from './components/auth/AuthCallback';
import { ContactForm } from './components/contacts/ContactForm';

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
          <span className="text-lg text-gray-600">Loading...</span>
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
  const { setUser, setIsLoading, setIsPremium } = useStore();

  // Separate premium status check
  const checkPremiumStatus = async () => {
    try {
      const status = await paymentService.getSubscriptionStatus();
      setIsPremium(status.isPremium);
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
          if (event === 'SIGNED_IN') {
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
    <QueryClientProvider client={queryClient}>
      <PayPalScriptProvider
        options={{
          clientId: import.meta.env.VITE_PAYPAL_CLIENT_ID || '',
          currency: 'USD',
          intent: 'subscription',
        }}
      >
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
        <BrowserRouter>
          <Layout>
            <Routes>
              {/* Public Routes */}
              <Route path="/login" element={<Login />} />
              <Route path="/auth/callback" element={<AuthCallback />} />
              
              {/* Protected Routes */}
              <Route
                path="/"
                element={
                  <AuthenticatedRoute>
                    <Dashboard />
                  </AuthenticatedRoute>
                }
              />
              
              <Route
                path="/contacts"
                element={
                  <AuthenticatedRoute>
                    <Contacts />
                  </AuthenticatedRoute>
                }
              />
              
              <Route
                path="/contacts/new"
                element={
                  <AuthenticatedRoute>
                    <ContactForm />
                  </AuthenticatedRoute>
                }
              />
              
              <Route
                path="/contacts/:id/edit"
                element={
                  <AuthenticatedRoute>
                    <ContactForm />
                  </AuthenticatedRoute>
                }
              />

              <Route
                path="/reminders"
                element={
                  <AuthenticatedRoute>
                    <Reminders />
                  </AuthenticatedRoute>
                }
              />
              <Route
                path="/settings"
                element={
                  <AuthenticatedRoute>
                    <Settings />
                  </AuthenticatedRoute>
                }
              />

              <Route
                path="/help"
                element={
                  <AuthenticatedRoute>
                    <Help />
                  </AuthenticatedRoute>
                }
              />
              
              {/* Catch all route */}
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </Layout>
        </BrowserRouter>
      </PayPalScriptProvider>
    </QueryClientProvider>
  );
}

export default App;
