import { supabase } from '../../lib/supabase/client';

export class PayPalService {
  async createSubscription(planId: string): Promise<string> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No active session');

      const response = await fetch(`https://api.touchbase.site/functions/v1/create-subscription`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'X-Client-Secret': import.meta.env.VITE_CLIENT_SECRET
        },
        body: JSON.stringify({ planId }),
      });

      const responseData = await response.json();
      
      if (!response.ok) {
        throw new Error(responseData.error || 'Failed to create subscription');
      }

      // Log the response for debugging
      console.log('PayPal subscription response:', responseData);

      const { subscriptionId, approvalUrl } = responseData;
      
      if (!approvalUrl) {
        throw new Error('No approval URL received from PayPal');
      }

      // Log before redirect
      console.log('Redirecting to PayPal approval URL:', approvalUrl);
      
      // Redirect to PayPal approval page
      window.location.href = approvalUrl;
      return subscriptionId;
    } catch (error) {
      console.error('Error creating PayPal subscription:', error);
      throw error;
    }
  }

  async cancelSubscription(accessToken: string): Promise<void> {
    try {
      const response = await fetch(`https://api.touchbase.site/functions/v1/cancel-subscription`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
          'X-Client-Secret': import.meta.env.VITE_CLIENT_SECRET
        }
      });

      const responseData = await response.json();
      
      if (!response.ok) {
        throw new Error(responseData.error || 'Failed to cancel subscription');
      }

      // Handle PayPal redirect URL if provided in response
      if (responseData.redirectUrl) {
        window.location.href = responseData.redirectUrl;
        return;
      }
    } catch (error) {
      console.error('Error canceling PayPal subscription:', error);
      throw error;
    }
  }
}

export const paypalService = new PayPalService();