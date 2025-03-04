import { initializeApp } from "firebase/app";
import { getMessaging, onMessage, getToken, Messaging } from "firebase/messaging";
import { supabase } from "../supabase/client";
import { firebaseConfig, fcmSettings } from "./config";
import { platform } from "../../utils/platform";

// Initialize Firebase app once
export const app = initializeApp(firebaseConfig);

// Manage messaging instance
let messagingInstance: Messaging | null = null;
export const getFirebaseMessaging = (): Messaging => {
  if (!messagingInstance) {
    messagingInstance = getMessaging(app);
  }
  return messagingInstance;
};

// Function to cleanup Firebase messaging instance
export const cleanupMessaging = async () => {
  const storageKey = platform.getDeviceStorageKey('device_id');
  const deviceId = localStorage.getItem(storageKey);
  if (!deviceId) {
    console.warn('No device ID found during cleanup');
    return;
  }

  // Clean up FCM instance from window
  // @ts-ignore
  if (window.firebase?.messaging) {
    // @ts-ignore
    delete window.firebase.messaging;
  }

  // Force clear service worker message listeners
  try {
    const registration = await navigator.serviceWorker.ready;
    const messageChannel = new MessageChannel();
    if (registration.active) {
      registration.active.postMessage({
        type: 'CLEAR_FCM_LISTENERS',
        deviceId: deviceId
      }, [messageChannel.port2]);
    }
  } catch (error) {
    console.warn('Error clearing FCM listeners:', error);
  }
  
  // Reset messaging instance
  messagingInstance = null;

  // Remove all service workers except Firebase messaging worker
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    for (const reg of registrations) {
      if (reg.active?.scriptURL.includes('firebase-messaging-sw.js')) {
        continue;
      }
      await reg.unregister();
    }
  } catch (error) {
    console.warn('Error unregistering service workers:', error);
  }

  console.log('Cleaned up messaging for device:', deviceId);
};

// Extended notification options type that includes all web notification properties
interface ExtendedNotificationOptions extends NotificationOptions {
  renotify?: boolean;
  requireInteraction?: boolean;
  tag?: string;
  actions?: Array<{
    action: string;
    title: string;
  }>;
  data?: any;
  vibrate?: number[];
  silent?: boolean;
}

// Helper function to show notification
const showNotification = async (title: string, options: ExtendedNotificationOptions) => {
  if (!('Notification' in window)) {
    console.warn('Notifications not supported');
    return;
  }

  if (Notification.permission !== 'granted') {
    console.warn('Notification permission not granted');
    return;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const notificationOptions: ExtendedNotificationOptions = {
      ...options,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: 'touchbase-notification',
      renotify: true,
      requireInteraction: platform.getDeviceInfo().deviceType === 'web'
    };
    await registration.showNotification(title, notificationOptions as NotificationOptions);
  } catch (error) {
    console.error('Error showing notification:', error);
  }
};

// Helper function to update token in database
const updateTokenInDatabase = async (userId: string, token: string) => {
  const deviceId = localStorage.getItem(platform.getDeviceStorageKey('device_id'));
  if (!deviceId) {
    console.warn('No device ID found for background refresh, skipping update');
    return;
  }

  // Get current device subscription state
  const { data: subscription } = await supabase
    .from('push_subscriptions')
    .select('enabled')
    .match({ user_id: userId, device_id: deviceId })
    .single();

  // Only update if notifications are enabled
  if (subscription?.enabled) {
    const { error } = await supabase
      .from('push_subscriptions')
      .update({
        fcm_token: token,
        updated_at: new Date().toISOString()
      })
      .match({ user_id: userId, device_id: deviceId });

    if (error) {
      console.error('Error updating FCM token:', error);
    } else {
      console.log('FCM token updated in database');
    }
  }
};

// Debug prefix for better log tracking
const DEBUG_PREFIX = '🔥 [Firebase Init]';

// Service worker initialization response type
interface ServiceWorkerInitResponse {
  success: boolean;
  deviceType?: string;
  isMobile?: boolean;
  error?: string;
}

// Handle token refresh and message handling
export const initializeTokenRefresh = async (userId: string) => {
  try {
    // Get device info
    const deviceInfo = platform.getDeviceInfo();
    const isMobileDevice = deviceInfo.deviceType !== 'web';
    console.log(`${DEBUG_PREFIX} Starting token refresh:`, {
      deviceType: deviceInfo.deviceType,
      isMobile: isMobileDevice,
      userId: userId.slice(0, 8)
    });

    // Wait for service worker to be ready
    console.log(`${DEBUG_PREFIX} Waiting for service worker...`);
    const registration = await navigator.serviceWorker.ready;
    console.log(`${DEBUG_PREFIX} Service worker ready:`, {
      state: registration.active?.state,
      scope: registration.scope
    });

    // Initialize service worker with device info
    console.log(`${DEBUG_PREFIX} Preparing service worker initialization...`, {
      deviceType: deviceInfo.deviceType,
      isMobile: isMobileDevice,
      swState: registration.active?.state
    });

    const messageChannel = new MessageChannel();
    const initResult = await new Promise<ServiceWorkerInitResponse>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Service worker initialization timeout'));
      }, 5000);

      messageChannel.port1.onmessage = async (event) => {
        clearTimeout(timeout);
        const response = event.data as ServiceWorkerInitResponse;
        console.log(`${DEBUG_PREFIX} Received init response:`, response);
        
        if (response.success && isMobileDevice) {
          // Add additional delay for mobile to ensure Firebase is fully initialized
          console.log(`${DEBUG_PREFIX} Adding mobile initialization delay...`);
          await new Promise(resolve => setTimeout(resolve, 1500));
          console.log(`${DEBUG_PREFIX} Mobile delay complete, proceeding...`);
        }
        
        resolve(response);
      };

      const deviceId = localStorage.getItem(platform.getDeviceStorageKey('device_id'));
      console.log(`${DEBUG_PREFIX} Sending init message with device info:`, {
        deviceType: deviceInfo.deviceType,
        deviceId: deviceId ? deviceId.slice(0, 8) + '...' : 'none',
        hasVapidKey: !!fcmSettings.vapidKey
      });

      registration.active?.postMessage({
        type: 'INIT_FCM',
        deviceInfo: {
          deviceType: deviceInfo.deviceType,
          deviceId: deviceId,
          isMobile: isMobileDevice
        },
        vapidKey: fcmSettings.vapidKey,
        firebase: {
          ...firebaseConfig,
          messagingSenderId: firebaseConfig.messagingSenderId
        }
      }, [messageChannel.port2]);
    });

    if (!initResult?.success) {
      console.error(`${DEBUG_PREFIX} Service worker initialization failed:`, initResult);
      throw new Error('Service worker initialization failed: ' + (initResult?.error || 'unknown error'));
    }

    console.log(`${DEBUG_PREFIX} Service worker initialization complete:`, {
      success: initResult.success,
      deviceType: initResult.deviceType,
      isMobile: initResult.isMobile
    });

    // Add delay after successful initialization for mobile
    if (isMobileDevice) {
      console.log(`${DEBUG_PREFIX} Adding mobile initialization delay...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log(`${DEBUG_PREFIX} Initializing Firebase messaging...`);
    let messaging: Messaging;
    try {
      messaging = getFirebaseMessaging();
      if (!messaging || !messaging.app) {
        console.log(`${DEBUG_PREFIX} Messaging not properly initialized, retrying...`);
        messagingInstance = null;
        messaging = getFirebaseMessaging();
        if (!messaging || !messaging.app) {
          throw new Error('Failed to initialize Firebase messaging');
        }
      }
      console.log(`${DEBUG_PREFIX} Firebase messaging initialized successfully`);
    } catch (error) {
      console.error(`${DEBUG_PREFIX} Failed to initialize Firebase messaging:`, error);
      throw error;
    }
    
    // Ensure we have an authenticated user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User must be authenticated for FCM token generation');
    }

    // Configuration for token generation using fcmSettings
    const tokenConfig = {
      vapidKey: fcmSettings.vapidKey,
      serviceWorkerRegistration: registration
    };
    console.log(`${DEBUG_PREFIX} Token config prepared:`, {
      hasVapidKey: !!fcmSettings.vapidKey,
      hasRegistration: !!registration
    });

    // Get current token
    let currentToken: string | null = null;
    try {
      if (isMobileDevice) {
        // Additional validation for mobile token generation
        if (!registration.active || registration.active.state !== 'activated') {
          console.error(`${DEBUG_PREFIX} Service worker not in proper state for mobile token generation`);
          throw new Error('Service worker not in activated state');
        }
        console.log(`${DEBUG_PREFIX} Starting mobile token generation...`, {
          deviceType: deviceInfo.deviceType,
          serviceWorkerState: registration.active?.state,
          scope: registration.scope,
          hasMessaging: !!messaging?.app
        });
        // Add pre-token delay for mobile
        await new Promise(resolve => setTimeout(resolve, 800));
      } else {
        console.log(`${DEBUG_PREFIX} Starting web token generation...`, {
          deviceType: deviceInfo.deviceType,
          serviceWorkerState: registration.active?.state,
          scope: registration.scope
        });
      }

      currentToken = await getToken(messaging, tokenConfig);
      
      if (!currentToken) {
        console.error(`${DEBUG_PREFIX} Token generation returned null`);
        throw new Error('Failed to generate FCM token');
      }

      // Validate token format
      const isValidToken = currentToken.length >= 50 && /^[A-Za-z0-9\-_=]+$/.test(currentToken);
      if (!isValidToken) {
        console.error(`${DEBUG_PREFIX} Invalid token format:`, {
          tokenLength: currentToken.length,
          isMobile: isMobileDevice,
          deviceType: deviceInfo.deviceType
        });
        throw new Error('Invalid FCM token format');
      }

      console.log(`${DEBUG_PREFIX} Token generated successfully:`, {
        tokenLength: currentToken.length,
        tokenPrefix: currentToken.substring(0, 8) + '...',
        deviceType: deviceInfo.deviceType,
        isValidFormat: isValidToken
      });

      // Add post-token delay for mobile
      if (isMobileDevice) {
        console.log(`${DEBUG_PREFIX} Adding post-token delay for mobile...`);
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    } catch (error: any) {
      console.error(`${DEBUG_PREFIX} Token generation failed:`, {
        errorCode: error.code,
        errorName: error.name,
        errorMessage: error.message,
        deviceType: deviceInfo.deviceType,
        serviceWorkerState: registration.active?.state,
        messagingConfig: {
          hasVapidKey: !!tokenConfig.vapidKey,
          hasRegistration: !!tokenConfig.serviceWorkerRegistration
        }
      });
      throw error;
    }

    console.log(`${DEBUG_PREFIX} Updating token in database...`);
    await updateTokenInDatabase(userId, currentToken);
    console.log(`${DEBUG_PREFIX} Token update complete`);

    // Set up periodic token refresh only for web
    if (!isMobileDevice) {
      const refreshToken = async () => {
        try {
          const registration = await navigator.serviceWorker.ready;
          const newToken = await getToken(messaging, {
            vapidKey: import.meta.env.VITE_VAPID_PUBLIC_KEY,
            serviceWorkerRegistration: registration
          });

          if (newToken && newToken !== currentToken) {
            await updateTokenInDatabase(userId, newToken);
            currentToken = newToken;
            console.log('FCM token refreshed successfully');
          }
        } catch (error) {
          console.error('Error in token refresh:', error);
        }
      };

      // Check token every 6 hours
      setInterval(refreshToken, 6 * 60 * 60 * 1000);
    }

    // Set up foreground message handler
    onMessage(messaging, async (payload) => {
      console.log('Received foreground message:', payload);

      const { notification } = payload;
      if (notification) {
        await showNotification(
          notification.title || 'New Message',
          {
            body: notification.body,
            data: payload.data,
            silent: isMobileDevice, // Silent on mobile to prevent duplicate notifications
            actions: [
              {
                action: 'view',
                title: 'View'
              }
            ]
          }
        );
      }

      // Handle token changes if needed
      if (payload.data?.type === 'token_change') {
        try {
          const newToken = await getToken(messaging, tokenConfig);

          if (newToken && newToken !== currentToken) {
            await updateTokenInDatabase(userId, newToken);
            currentToken = newToken;
          }
        } catch (error) {
          console.error('Error in token change handler:', error);
        }
      }
    });
  } catch (error) {
    console.error('Error setting up token refresh:', error);
    throw error;
  }
};