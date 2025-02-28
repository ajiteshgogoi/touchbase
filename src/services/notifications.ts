import { supabase } from '../lib/supabase/client';
import { getToken } from "firebase/messaging";
import { messaging, initializeTokenRefresh, cleanupMessaging } from '../lib/firebase';
import { platform } from '../utils/platform';
import { notificationDiagnostics } from './notification-diagnostics';

interface DeviceNotificationState {
  enabled: boolean;
}

export class NotificationService {
  private registration: ServiceWorkerRegistration | null = null;
  private readonly firebaseSWURL: string;

  constructor() {
    this.firebaseSWURL = new URL('/firebase-messaging-sw.js', window.location.origin).href;
  }

  // Get notification state for specific device
  async getDeviceNotificationState(userId: string, deviceId: string): Promise<boolean> {
    
    const { data, error } = await supabase
      .rpc('get_device_notification_state', {
        p_user_id: userId,
        p_device_id: deviceId
      });

    if (error) {
      console.error('Error getting device notification state:', error);
      return false;
    }
    
    const result = data as DeviceNotificationState | null;
    if (!result) {
      return false;
    }
    return result.enabled;
  }

  // Get current device notification state
  async getCurrentDeviceNotificationState(userId: string): Promise<boolean> {
    const deviceId = localStorage.getItem(platform.getDeviceStorageKey('device_id'));
    if (!deviceId) return false;
    
    return this.getDeviceNotificationState(userId, deviceId);
  }

  // Toggle device notifications
  async toggleDeviceNotifications(userId: string, deviceId: string, enabled: boolean): Promise<void> {
    try {
      type DeviceSubscription = { enabled: boolean; fcm_token: string | null };
      
      const { data, error: fetchError } = await supabase
        .rpc('get_device_subscription', {
          p_user_id: userId,
          p_device_id: deviceId
        });

      const subscription = data as DeviceSubscription;

      if (fetchError || !subscription) {
        throw new Error(`Failed to fetch device subscription: ${fetchError?.message || 'No data returned'}`);
      }

      // If enabling notifications and no FCM token exists, need to resubscribe
      if (enabled && !subscription?.fcm_token) {
        if (deviceId === localStorage.getItem(platform.getDeviceStorageKey('device_id'))) {
          // Only attempt FCM registration for current device
          await this.subscribeToPushNotifications(userId, true, true);
        } else {
          throw new Error('Cannot enable notifications for inactive device');
        }
      } else {
        // Update enabled state
        const { error: updateError } = await supabase
          .from('push_subscriptions')
          .update({ enabled })
          .match({ user_id: userId, device_id: deviceId });

        if (updateError) {
          throw new Error(`Failed to update device notification state: ${updateError.message}`);
        }
      }

      // Always fetch the latest state after update
      const { data: updatedSubscription, error: verifyError } = await supabase
        .from('push_subscriptions')
        .select('enabled')
        .match({ user_id: userId, device_id: deviceId })
        .single();

      if (verifyError || updatedSubscription?.enabled !== enabled) {
        throw new Error('Failed to verify device notification state update');
      }

    } catch (error) {
      console.error('Error toggling device notifications:', error);
      throw error;
    }
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

  async subscribeToPushNotifications(userId: string, forceResubscribe = false, enableNotifications = true): Promise<void> {
    if (!this.registration) {
      console.warn('Firebase service worker not registered, initializing...');
      await this.initialize();
      if (!this.registration) {
        throw new Error('Failed to initialize Firebase service worker');
      }
    }

    try {
      // Check for existing device subscription if not forcing resubscribe
      if (!forceResubscribe) {
        const deviceId = localStorage.getItem(platform.getDeviceStorageKey('device_id'));
        const { data: existingSubscription } = await supabase
          .rpc('get_device_subscription', {
            p_user_id: userId,
            p_device_id: deviceId
          });
          
        // Only use existing token if both token exists and notifications are enabled
        if (existingSubscription?.fcm_token && existingSubscription.enabled) {
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

      // Get device info and determine proper installation type
      const deviceInfo = platform.getDeviceInfo();
      const storageKey = platform.getDeviceStorageKey('device_id');
      const storedDeviceId = localStorage.getItem(storageKey);
      
      // Generate or validate device ID
      let deviceId = storedDeviceId;
      if (!deviceId?.startsWith(platform.getStorageNamespace())) {
        deviceId = platform.generateDeviceId();
      }

      // Handle device migrations and resubscriptions
      if (storedDeviceId) {
        const { data: existingTokens } = await supabase
          .rpc('get_user_device_tokens', {
           p_user_id: userId,
           p_namespace: platform.getStorageNamespace()
          });

        // Handle any existing tokens for this device
        if (existingTokens?.length) {
          const existingToken = existingTokens.find((token: { device_id: string }) => token.device_id === storedDeviceId);
          if (existingToken) {
            // Check for device type changes
            const deviceTypeChanged = existingToken.device_type !== deviceInfo.deviceType;

            if (deviceTypeChanged) {
              console.log('Device type change detected, migrating device...');
              // Clean up old subscription completely for type changes
              await this.unsubscribeFromPushNotifications(userId, storedDeviceId, true);
              deviceId = platform.generateDeviceId();
              // Don't preserve enabled state for new device types
              enableNotifications = true;
            } else if (forceResubscribe) {
              console.log('Force resubscribe requested, refreshing registration...');
              // For same device type, preserve enabled state
              enableNotifications = existingToken.enabled;
              // Clean up FCM token for resubscription
              await this.unsubscribeFromPushNotifications(userId, storedDeviceId, true);
              deviceId = storedDeviceId;
            } else {
              // Normal token refresh, preserve enabled state
              enableNotifications = existingToken.enabled;
            }
            
            // Log detailed device state for debugging
            console.log('Device state:', {
              currentType: deviceInfo.deviceType,
              previousType: existingToken.device_type,
              enabled: enableNotifications,
              isTypeChange: deviceTypeChanged,
              isResubscribe: forceResubscribe,
              installType: deviceInfo.isTWA ? 'TWA' : deviceInfo.isPWA ? 'PWA' : 'browser',
              deviceId: deviceId,
              storedDeviceId: storedDeviceId
            });
          }
        }
      }

      // Get FCM token with mobile-specific handling
      console.log('Getting FCM token...');
      let currentToken;
      try {
        // Ensure service worker is fully ready using MessageChannel
        await new Promise<void>((resolve, reject) => {
          const channel = new MessageChannel();
          
          // Handle service worker response
          channel.port1.onmessage = (event) => {
            if (event.data?.success) {
              console.log('FCM initialization confirmed by service worker');
              resolve();
            } else {
              reject(new Error(`FCM initialization failed: ${event.data?.error || 'Unknown error'}`));
            }
          };
  
          // Send initialization request to service worker
          if (!this.registration?.active) {
            reject(new Error('Service worker not active'));
            return;
          }
  
          this.registration.active.postMessage(
            { type: 'INIT_FCM' },
            [channel.port2]
          );
  
          // Add timeout for initialization
          setTimeout(() => {
            reject(new Error('FCM initialization timeout'));
          }, 10000);
        });
  
        // Multiple attempts for token retrieval
        let attempts = 0;
        const maxAttempts = 3;
        
        while (attempts < maxAttempts) {
          try {
            currentToken = await getToken(messaging, {
              vapidKey: import.meta.env.VITE_VAPID_PUBLIC_KEY,
              serviceWorkerRegistration: this.registration
            });
            break;
          } catch (tokenError) {
            attempts++;
            if (attempts === maxAttempts) throw tokenError;
            console.log(`FCM token attempt ${attempts} failed, retrying...`);
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      } catch (error) {
        console.error('FCM token error:', error);
        // Let the diagnostic error propagate up
        throw await notificationDiagnostics.handleFCMError(error, deviceInfo);
      }

      if (!currentToken) {
        // This should never happen as handleFCMError will throw if token retrieval fails
        throw new Error('Failed to get FCM token - no error was thrown but token is null');
      }

      console.log('Successfully obtained FCM token');

      // Set device attributes using already validated device info
      const deviceName = `${deviceInfo.deviceBrand} ${deviceInfo.isTWA ? 'TWA' : deviceInfo.isPWA ? 'PWA' : deviceInfo.browserInfo}`;
      const deviceType = deviceInfo.deviceType; // Use validated device type from platform utility
  
      let refreshCount = 0;
      let currentExpiryDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days from now

      // Get current device info for rate limiting
      if (!forceResubscribe) {
        const { data: existingDevice } = await supabase
          .rpc('get_device_subscription', {
            p_user_id: userId,
            p_device_id: deviceId
          });

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
          refresh_count: refreshCount,
          enabled: enableNotifications
        }, {
          onConflict: 'user_id,device_id'
        });

      if (error) {
        console.error('Failed to store FCM token:', error);
        if (error.message?.includes('check_refresh_rate')) {
          // Check response details to determine exact cause
          if (error.details?.includes('refresh_count')) {
            throw new Error('Maximum refresh limit (1000) reached for this device. Please unregister and register again.');
          } else {
            throw new Error('Invalid timestamp detected. Please try again.');
          }
        } else if (error.message?.includes('check_device_limit')) {
          throw new Error('Maximum number of devices (10) reached. Please unregister an existing device first.');
        } else if (error.message?.includes('unique_user_device')) {
          // Handle race condition where device already exists
          console.log('Device already exists, attempting to update...');
          const { error: updateError } = await supabase
            .from('push_subscriptions')
            .update({
              fcm_token: currentToken,
              expires_at: currentExpiryDate.toISOString(),
              refresh_count: refreshCount,
              enabled: enableNotifications
            })
            .match({ user_id: userId, device_id: deviceId });
            
          if (updateError) {
            console.error('Failed to update existing device:', updateError);
            throw updateError;
          }
        } else {
          console.error('Failed to store FCM token in Supabase:', error);
          throw error;
        }
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
      // Get current device ID using platform utilities
      const storageKey = platform.getDeviceStorageKey('device_id');
      const deviceId = localStorage.getItem(storageKey);
      
      // Verify with the server for this specific device
      console.log('Verifying FCM token with server...');
      const { data: existingSubscription } = await supabase
        .rpc('get_device_subscription', {
          p_user_id: userId,
          p_device_id: deviceId
        });

      // Don't auto-resubscribe if device exists but notifications are disabled
      if (existingSubscription && !existingSubscription.enabled) {
        console.log('Device exists but notifications are disabled');
        return;
      }

      // No existing subscription or missing device ID
      if (!existingSubscription?.fcm_token || !deviceId) {
        try {
          console.log('Creating new subscription with notifications enabled...');
          // Create and enable subscription in one step
          await this.subscribeToPushNotifications(userId, true, true);
          // Get fresh device ID and verify subscription state
          const newDeviceId = localStorage.getItem(platform.getDeviceStorageKey('device_id'));
          if (!newDeviceId) {
            throw new Error('Failed to get device ID after subscription');
          }
          // Verify subscription state
          const { data: subscription } = await supabase
            .from('push_subscriptions')
            .select('enabled, fcm_token')
            .match({ user_id: userId, device_id: newDeviceId })
            .single();
          
          if (!subscription?.enabled || !subscription?.fcm_token) {
            console.error('Subscription verification failed:', subscription);
            throw new Error('Failed to verify subscription state');
          }
          return;
        } catch (error) {
          console.error('Failed to create and enable subscription:', error);
          throw error;
        }
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
        // Keep existing enabled state when resubscribing
        await this.subscribeToPushNotifications(userId, true, existingSubscription.enabled);
        return;
      }

      console.log('FCM token verified successfully');
    } catch (error) {
      console.error('Error in resubscribeIfNeeded:', error);
      // If any error occurs during verification, try a fresh subscription
      console.log('Error during verification, attempting fresh subscription...');
      try {
        // Create new subscription first
        await this.subscribeToPushNotifications(userId, true, false);
        // Get fresh device ID after subscription
        const newDeviceId = localStorage.getItem(platform.getDeviceStorageKey('device_id'));
        if (!newDeviceId) {
          throw new Error('Failed to get device ID after subscription');
        }
        // Enable through toggle flow
        await this.toggleDeviceNotifications(userId, newDeviceId, true);
      } catch (subError) {
        console.error('Failed to create fresh subscription:', subError);
        throw subError;
      }
    }
  }

  async unsubscribeFromPushNotifications(userId: string, specificDeviceId?: string, forceResubscribe = false): Promise<void> {
    try {
      console.log('Unsubscribing from push notifications...');
      
      // 1. Get device identifiers
      const storageKey = platform.getDeviceStorageKey('device_id');
      const currentDeviceId = localStorage.getItem(storageKey);
      const targetDeviceId = specificDeviceId || currentDeviceId;
      
      if (!targetDeviceId) {
        console.warn('No device ID found for unsubscription');
        return;
      }

      // Get current device info to check for type changes
      const deviceInfo = platform.getDeviceInfo();

      // 2. Get all tokens for this device (might have multiple due to type changes)
      const { data: subscriptions } = await supabase
        .rpc('get_device_subscription', {
          p_user_id: userId,
          p_device_id: targetDeviceId
        });

      if (!subscriptions?.length) {
        console.log('No subscriptions found for this device');
        return;
      }

      // 3. Clean up Firebase messaging instance if unsubscribing current device
      if (targetDeviceId === currentDeviceId) {
        await cleanupMessaging();
      }

      // 4. Update device subscription
      console.log('Updating device subscription state...');
      
      const isDeviceTypeChange = subscriptions[0]?.device_type !== deviceInfo.deviceType;
      
      const { error } = await supabase
        .from('push_subscriptions')
        .update({
          // Keep enabled=true for device type changes or force resubscribe
          enabled: isDeviceTypeChange || forceResubscribe ? true : false,
          // Always clear FCM token for reregistration
          fcm_token: null
        })
        .match({
          user_id: userId,
          device_id: targetDeviceId
        });

      // Log state for debugging
      console.log('Device unsubscribe state:', {
        deviceId: targetDeviceId,
        isDeviceTypeChange,
        forceResubscribe,
        previousType: subscriptions[0]?.device_type,
        currentType: deviceInfo.deviceType
      });

      if (error) {
        console.error('Failed to update device subscription:', error);
        throw error;
      }

      // 5. Clean up local storage for current device and ensure we don't keep stale installation type
      if (targetDeviceId === currentDeviceId) {
        localStorage.removeItem(storageKey);
      }

      console.log('Successfully unsubscribed device from push notifications');
    } catch (error) {
      console.error('Failed to unsubscribe from push notifications:', error);
      throw error;
    }
  }

  async checkPermission(forGlobalSetting: boolean = false): Promise<boolean> {
    if (!('Notification' in window)) {
      return false;
    }

    // First check browser permission
    if (Notification.permission === 'denied') {
      return false;
    }

    // For global settings, only check browser permission
    if (forGlobalSetting) {
      // If permission not granted yet, request it
      if (Notification.permission === 'default') {
        const permission = await Notification.requestPermission();
        return permission === 'granted';
      }
      return true;
    }

    // For device-specific checks, also check device state
    const deviceId = localStorage.getItem(platform.getDeviceStorageKey('device_id'));
    if (deviceId) {
      const { data: subscription } = await supabase
        .rpc('get_device_notification_state', {
          p_user_id: (await supabase.auth.getSession()).data.session?.user.id!,
          p_device_id: deviceId
        });
      
      if (subscription?.enabled === false) {
        return false;
      }
    }

    // If permission not granted yet, request it
    if (Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }

    return true;
  }

  async cleanupAllDevices(): Promise<void> {
    try {
      // Clean up Firebase messaging instance for current device
      await cleanupMessaging();
      
      // Clear all device-specific storage keys
      const storageKey = platform.getDeviceStorageKey('device_id');
      localStorage.removeItem(storageKey);

      // Only remove the current device's token
      const deviceId = localStorage.getItem(platform.getDeviceStorageKey('device_id'));
      if (deviceId) {
        await this.unsubscribeFromPushNotifications(
          (await supabase.auth.getSession()).data.session?.user.id!,
          deviceId
        );
      }
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