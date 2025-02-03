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
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-gray-600">Loading...</div>
      </div>
    );
  }
  
  return user ? <>{children}</> : <Navigate to="/login" replace />;
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

        // Handle premium status separately
        if (session?.user) {
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
