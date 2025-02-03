import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PayPalScriptProvider } from '@paypal/react-paypal-js';
import { Toaster } from 'react-hot-toast';
import { Layout } from './components/layout/Layout';
import { useStore } from './stores/useStore';
import { supabase } from './lib/supabase/client';
import { paymentService } from './services/payment';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';

// Page Imports
import { Dashboard } from './pages/Dashboard';
import { Contacts } from './pages/Contacts';
import { Settings } from './pages/Settings';
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
  
  // While checking auth status, show a loading indicator
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-gray-600">
          Loading...
        </div>
      </div>
    );
  }
  
  return user ? <>{children}</> : <Navigate to="/login" replace />;
};

function App() {
  const { setUser, setIsLoading, setIsPremium } = useStore();

  useEffect(() => {
    let isSubscribed = true;
    let loadingTimeout: NodeJS.Timeout;

    const initializeAuth = async () => {
      try {
        console.log('Initializing auth...');
        // Set a timeout to prevent infinite loading
        loadingTimeout = setTimeout(() => {
          if (isSubscribed) {
            console.log('Auth initialization timed out');
            setIsLoading(false);
            setUser(null);
          }
        }, 10000); // 10 second timeout

        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (!isSubscribed) return;

        if (error) {
          console.error('Error getting initial session:', error);
          setUser(null);
        } else {
          console.log('Initial session:', session?.user?.email);
          setUser(session?.user ?? null);
          
          if (session?.user) {
            try {
              const subscriptionStatus = await paymentService.getSubscriptionStatus();
              if (isSubscribed) {
                setIsPremium(subscriptionStatus.isPremium);
              }
            } catch (error) {
              console.error('Error getting subscription status:', error);
              if (isSubscribed) {
                setIsPremium(false);
              }
            }
          } else {
            setIsPremium(false);
          }
        }
      } catch (error) {
        console.error('Failed to get initial session:', error);
        if (isSubscribed) {
          setUser(null);
        }
      } finally {
        if (isSubscribed) {
          clearTimeout(loadingTimeout);
          setIsLoading(false);
        }
      }
    };

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event: AuthChangeEvent, session: Session | null) => {
      console.log('Auth state changed:', event, session?.user?.email);
      
      if (!isSubscribed) return;

      // Handle loading state for specific auth events
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
        setIsLoading(true);
      }

      try {
        setUser(session?.user ?? null);
        
        if (session?.user) {
          const subscriptionStatus = await paymentService.getSubscriptionStatus();
          if (isSubscribed) {
            setIsPremium(subscriptionStatus.isPremium);
          }
        } else {
          setIsPremium(false);
        }
      } catch (error) {
        console.error('Error handling auth state change:', error);
        if (isSubscribed) {
          setIsPremium(false);
        }
      } finally {
        if (isSubscribed) {
          setIsLoading(false);
        }
      }
    });

    // Initialize auth
    initializeAuth();

    return () => {
      isSubscribed = false;
      clearTimeout(loadingTimeout);
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
                path="/settings"
                element={
                  <AuthenticatedRoute>
                    <Settings />
                  </AuthenticatedRoute>
                }
              />
              
              {/* Catch all route */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Layout>
        </BrowserRouter>
      </PayPalScriptProvider>
    </QueryClientProvider>
  );
}

export default App;
