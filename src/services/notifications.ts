import { supabase } from '../lib/supabase/client';
import { getToken } from "firebase/messaging";
import { messaging, initializeTokenRefresh, cleanupMessaging } from '../lib/firebase';
import { platform } from '../utils/platform';

class NotificationService {
  private registration: ServiceWorkerRegistration | null = null;
  private readonly firebaseSWURL: string;

  constructor() {
    this.firebaseSWURL = new URL('/firebase-messaging-sw.js', window.location.origin).href;
  }

  async initialize(retryDelay = 2000): Promise<void> {
      if (!('serviceWorker' in navigator)) {
        console.warn('Service workers are not supported');
        return;
      }

      try {
        // Wait for valid session before proceeding
        const maxRetries = 3;
        let authToken = null;
        
        for (let i = 0; i < maxRetries; i++) {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.access_token) {
            authToken = session.access_token;
            break;
          }
          // Wait between retries with increasing delay
          await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        }

        if (!authToken) {
          throw new Error('No valid auth token available');
        }

        // Add delay to ensure auth token is properly propagated
        await new Promise(resolve => setTimeout(resolve, retryDelay));

        // Now proceed with service worker operations
        const existingRegistrations = await navigator.serviceWorker.getRegistrations();
        
        // Only unregister service workers that aren't our Firebase messaging worker
        for (const reg of existingRegistrations) {
          const swUrl = reg.active?.scriptURL;
          if (swUrl && swUrl !== this.firebaseSWURL) {
            console.log('Unregistering service worker:', swUrl);
            await reg.unregister();
          }
        }

        // Check if we already have a valid Firebase messaging service worker
        const existingFirebaseSW = existingRegistrations.find(reg =>
          reg.active?.scriptURL === this.firebaseSWURL
        );

        if (existingFirebaseSW) {
          console.log('Using existing Firebase messaging service worker');
          this.registration = existingFirebaseSW;
          return;
        }

        // Register Firebase messaging service worker if not found
        console.log('Registering Firebase messaging service worker...');
        
        // Register with explicit options for better control
        this.registration = await navigator.serviceWorker.register(this.firebaseSWURL, {
          scope: '/',
          updateViaCache: 'none'
        });

      // Ensure service worker is ready and active
      if (!this.registration) {
        throw new Error('Service worker registration failed');
      }

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Service worker activation timeout'));
        }, 10000); // 10 second timeout

        const checkActivation = async () => {
          if (!this.registration) {
            clearTimeout(timeout);
            reject(new Error('Service worker registration lost'));
            return;
          }

          if (this.registration.active) {
            clearTimeout(timeout);
            resolve();
            return;
          }

          const sw = this.registration.installing || this.registration.waiting;
          if (!sw) {
            clearTimeout(timeout);
            reject(new Error('No service worker found'));
            return;
          }

          sw.addEventListener('statechange', function listener(e) {
            if ((e.target as ServiceWorker).state === 'activated') {
              sw.removeEventListener('statechange', listener);
              clearTimeout(timeout);
              resolve();
            }
          });
        };

        checkActivation();
      });

      // Update the service worker if needed
      if (this.registration) {
        await this.registration.update();
      }

      console.log('Firebase service worker successfully registered and activated');

      // A small delay to ensure the service worker is fully ready
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Initialize token refresh mechanism if user is authenticated
      const session = await supabase.auth.getSession();
      if (session.data.session?.user) {
        await initializeTokenRefresh(session.data.session.user.id);
      }
    } catch (error) {
      console.error('Service Worker registration failed:', error);
    }
  }

  async subscribeToPushNotifications(userId: string, forceResubscribe = false): Promise<void> {
    if (!this.registration) {
      console.warn('Firebase service worker not registered, initializing...');
      await this.initialize();
      if (!this.registration) {
        throw new Error('Failed to initialize Firebase service worker');
      }
    }

    try {
      // Check for existing subscription if not forcing resubscribe
      if (!forceResubscribe) {
        const { data: existingSubscription } = await supabase
          .from('push_subscriptions')
          .select('fcm_token')
          .eq('user_id', userId)
          .maybeSingle();
          
        if (existingSubscription?.fcm_token) {
          console.log('Using existing FCM token');
          return;
        }
      }

      console.log('Starting FCM token registration process...');
      
      // Request permission first
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        throw new Error('Notification permission denied');
      }

      // Check IndexedDB access before proceeding
      try {
        console.log('Verifying IndexedDB access...');
        const request = indexedDB.open('fcm-test-db');
        await new Promise<void>((resolve, reject) => {
          request.onerror = () => reject(new Error('IndexedDB access denied - check browser settings'));
          request.onsuccess = () => {
            request.result.close();
            resolve();
          };
        });
        console.log('IndexedDB access confirmed');
      } catch (error) {
        console.error('IndexedDB access error:', error);
        throw new Error('Browser storage access denied - check privacy settings and third-party cookie settings');
      }

      // Ensure Firebase service worker is ready
      if (!this.registration?.active) {
        console.log('Firebase service worker not active, reinitializing...');
        await this.initialize();
        if (!this.registration?.active) {
          throw new Error('Firebase service worker failed to activate');
        }
      }

      // Get FCM token using existing VAPID key
      console.log('Getting FCM token...');
      const currentToken = await getToken(messaging, {
        vapidKey: import.meta.env.VITE_VAPID_PUBLIC_KEY,
        serviceWorkerRegistration: this.registration
      }).catch(error => {
        console.error('FCM token error:', error);
        throw new Error(`FCM registration failed: ${error.message}`);
      });

      if (!currentToken) {
        throw new Error('Failed to get FCM token');
      }

      console.log('Successfully obtained FCM token');

      // Get device info with detailed context
      const deviceType = platform.getDeviceType(); // 'android', 'ios', or 'web'
      const installMode = platform.isTWA() ? 'TWA' : platform.isPWA() ? 'PWA' : 'Browser';
      const browserInfo = platform.getBrowserIdentifier(); // e.g., "Chrome98", "Firefox97"
      const deviceModel = platform.getDeviceModel(); // e.g., "Pixel 6", "iPhone 13"
      
      // Create installation-specific storage key
      const storageKey = `device_id_${installMode.toLowerCase()}_${browserInfo}`;
      const storedDeviceId = localStorage.getItem(storageKey);
      
      // Create unique device ID that includes all context
      const deviceId = storedDeviceId || [
        deviceType,
        installMode.toLowerCase(),
        browserInfo,
        deviceModel.replace(/[^a-zA-Z0-9]/g, ''), // Sanitize device model
        Math.random().toString(36).substring(2),
        Date.now()
      ].join('-');
      
      localStorage.setItem(storageKey, deviceId);
  
      // Create detailed device name
      const deviceName = `${deviceModel} (${deviceType.toUpperCase()} - ${installMode} - ${browserInfo})`;
      
      let refreshCount = 0;
      let currentExpiryDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days from now

      // Get current device info for rate limiting
      if (!forceResubscribe) {
        const { data: existingDevice } = await supabase
          .from('push_subscriptions')
          .select('refresh_count, last_refresh, expires_at')
          .match({ user_id: userId, device_id: deviceId })
          .maybeSingle();

        // Check rate limits and expiry
        if (existingDevice) {
          // Check expiry first
          if (new Date(existingDevice.expires_at) < new Date()) {
            console.log('Token expired, forcing resubscription');
            forceResubscribe = true;
            refreshCount = 0;
          }
          // Check refresh count limit
          else if (existingDevice.refresh_count >= 1000) {
            throw new Error('Maximum refresh limit (1000) reached for this device. Please unregister and register again.');
          }
          else {
            refreshCount = existingDevice.refresh_count + 1;
            currentExpiryDate = new Date(existingDevice.expires_at);
          }
        }
      }

      const { error } = await supabase
        .from('push_subscriptions')
        .upsert({
          user_id: userId,
          fcm_token: currentToken,
          device_id: deviceId,
          device_name: deviceName,
          device_type: deviceType,
          expires_at: currentExpiryDate.toISOString(),
          refresh_count: refreshCount
        }, {
          onConflict: 'user_id,device_id'
        });

      if (error) {
       if (error.message?.includes('check_refresh_rate')) {
         // Check response details to determine exact cause
         if (error.details?.includes('refresh_count')) {
           throw new Error('Maximum refresh limit (1000) reached for this device. Please unregister and register again.');
         } else {
           throw new Error('Invalid timestamp detected. Please try again.');
         }
       } else if (error.message?.includes('check_device_limit')) {
         throw new Error('Maximum number of devices (10) reached. Please unregister an existing device first.');
       }
       
       console.error('Failed to store FCM token in Supabase:', error);
       throw error;
     }

      // Verify token was stored (might be cleaned up by trigger)
      const { data: storedToken } = await supabase
        .from('push_subscriptions')
        .select('fcm_token')
        .match({ user_id: userId, device_id: deviceId })
        .maybeSingle();

      if (!storedToken?.fcm_token) {
        console.log('Token might have been cleaned up, retrying subscription...');
        if (!forceResubscribe) {
          return this.subscribeToPushNotifications(userId, true);
        }
        throw new Error('Failed to store FCM token - possible cleanup or constraint violation');
      }

      console.log('Successfully completed FCM token registration process');
    } catch (error) {
      console.error('Failed to register for FCM:', error);
      throw error;
    }
  }

  async resubscribeIfNeeded(userId: string): Promise<void> {
    try {
      // Get current device ID
      const deviceId = localStorage.getItem('device_id');
      
      // Verify with the server for this specific device
      console.log('Verifying FCM token with server...');
      const { data: existingSubscription } = await supabase
        .from('push_subscriptions')
        .select('fcm_token')
        .match({
          user_id: userId,
          device_id: deviceId
        })
        .maybeSingle();

      if (!existingSubscription?.fcm_token || !deviceId) {
        console.log('No existing subscription found for this device, creating new one...');
        await this.subscribeToPushNotifications(userId, true);
        return;
      }

      // If we have a token, verify it with the server
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/push-notifications/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        },
        body: JSON.stringify({ userId })
      });

      const data = await response.json();
      
      if (response.status === 500 && (
        data.error?.includes('resubscription required') ||
        data.error?.includes('FCM token invalid') ||
        data.error?.includes('No FCM token found')
      )) {
        console.log('Server indicates token invalid or missing, creating new subscription...');
        await this.subscribeToPushNotifications(userId, true);
        return;
      }

      console.log('FCM token verified successfully');
    } catch (error) {
      console.error('Error in resubscribeIfNeeded:', error);
      // If any error occurs during verification, try a fresh subscription
      console.log('Error during verification, attempting fresh subscription...');
      try {
        await this.subscribeToPushNotifications(userId, true);
      } catch (subError) {
        console.error('Failed to create fresh subscription:', subError);
        throw subError;
      }
    }
  }

  async unsubscribeFromPushNotifications(userId: string, specificDeviceId?: string): Promise<void> {
    try {
      console.log('Unsubscribing from push notifications...');
      
      // Get current device info
      const installMode = platform.isTWA() ? 'twa' : platform.isPWA() ? 'pwa' : 'browser';
      const currentDeviceId = localStorage.getItem(`device_id_${installMode}`);
      const targetDeviceId = specificDeviceId || currentDeviceId;
      
      if (!targetDeviceId) {
        console.warn('No device ID found for unsubscription');
        return;
      }

      if (targetDeviceId === currentDeviceId) {
        await cleanupMessaging();
      }

      // Remove device's FCM token from Supabase
      console.log('Removing FCM token for device from Supabase...');
      const { error } = await supabase
        .from('push_subscriptions')
        .delete()
        .match({
          user_id: userId,
          device_id: targetDeviceId
        });

      if (error) {
        throw error;
      }

      // Clear device ID from local storage if it's the current device
      if (targetDeviceId === currentDeviceId) {
        // Remove the installation-specific device ID
        localStorage.removeItem(`device_id_${installMode}`);
      }

      console.log('Successfully unsubscribed device from push notifications');
    } catch (error) {
      console.error('Failed to unsubscribe from push notifications:', error);
      throw error;
    }
  }

  async checkPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
      return false;
    }

    if (Notification.permission === 'granted') {
      return true;
    }

    if (Notification.permission === 'denied') {
      return false;
    }

    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  async cleanupAllDevices(): Promise<void> {
    try {
      // Clean up Firebase messaging instance for current device
      await cleanupMessaging();
      
      // Clean up all device IDs from localStorage
      const deviceIdKeys = Object.keys(localStorage).filter(key =>
        key.startsWith('device_id_')
      );
      
      console.log(`Found ${deviceIdKeys.length} device IDs to clean up`);
      
      for (const key of deviceIdKeys) {
        localStorage.removeItem(key);
      }
      
      // For backwards compatibility, remove old device_id if it exists
      localStorage.removeItem('device_id');
      
      console.log('Successfully cleaned up all device IDs');
    } catch (error) {
      console.error('Failed to cleanup all devices:', error);
      throw error;
    }
  }

  async sendTestNotification(userId: string, message?: string): Promise<void> {
    try {
      console.log('Starting test notification sequence...');
      
      // First ensure fresh service worker registration
      await this.initialize();
      
      if (!this.registration?.active) {
        throw new Error('Firebase service worker failed to activate after initialization');
      }

      const session = await supabase.auth.getSession();
      const isAdmin = session.data.session?.user.id === import.meta.env.VITE_ADMIN_USER_ID;
      const targetingOtherUser = session.data.session?.user.id !== userId;

      if (isAdmin && targetingOtherUser) {
        console.log('Admin sending test notification to other user...');
        
        // First verify target user has any valid FCM tokens
        const { data: targetSubscriptions } = await supabase
          .from('push_subscriptions')
          .select('fcm_token')
          .eq('user_id', userId);
          
        if (!targetSubscriptions?.length) {
          throw new Error('Target user does not have any FCM tokens. They need to enable notifications first.');
        }

        // Then ensure admin's registration is valid
        if (!this.registration?.active) {
          console.log('Initializing admin FCM registration...');
          // First ensure admin has notification permission
          const permission = await Notification.requestPermission();
          if (permission !== 'granted') {
            throw new Error('Notification permission required for admin operations');
          }

          // Force a clean service worker registration
          if (this.registration) {
            await this.registration.unregister();
            this.registration = null;
          }

          // Register Firebase service worker
          this.registration = await navigator.serviceWorker.register(this.firebaseSWURL, {
            scope: '/',
            updateViaCache: 'none'
          });

          // Wait for activation
          if (this.registration.installing || this.registration.waiting) {
            await new Promise<void>((resolve) => {
              const sw = this.registration!.installing || this.registration!.waiting;
              if (!sw) {
                resolve();
                return;
              }

              sw.addEventListener('statechange', function listener(event: Event) {
                if ((event.target as ServiceWorker).state === 'activated') {
                  sw.removeEventListener('statechange', listener);
                  resolve();
                }
              });
            });
          }

          // Initialize admin's token
          await this.subscribeToPushNotifications(session.data.session!.user.id, true);
        }
      } else {
        // For non-admin users or admin testing own notifications
        console.log('Creating fresh FCM token...');
        await this.subscribeToPushNotifications(userId, true);
      }

      // Final verification
      if (!this.registration?.active) {
        throw new Error('Firebase service worker failed to activate');
      }
      
      console.log('Sending test notification...');
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/push-notifications/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        },
        body: JSON.stringify({
          userId,
          message: message || 'This is a test notification'
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to send test notification');
      }

      console.log('Test notification sent successfully. If you do not see the notification, check:');
      console.log('1. Browser notification permissions');
      console.log('2. Service worker logs in DevTools > Application > Service Workers');
      console.log('3. Network tab for the FCM response');
    } catch (error) {
      console.error('Failed to send test notification:', error);
      throw error;
    }
  }
}

export const notificationService = new NotificationService();

// Make service available globally for testing
if (import.meta.env.DEV) {
  (window as any).notificationService = notificationService;
}