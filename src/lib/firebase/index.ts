import { initializeApp, FirebaseApp } from "firebase/app";
import { getMessaging, onMessage, getToken, Messaging } from "firebase/messaging";
import { supabase } from "../supabase/client";
import { firebaseConfig, fcmSettings } from "./config";
import { platform } from "../../utils/platform";

// Constants
const DEBUG_PREFIX = '🔥 [Firebase Init]';

// Initialize Firebase app once and validate configuration
let app: FirebaseApp;
try {
  // Validate required Firebase config
  const requiredKeys: (keyof typeof firebaseConfig)[] = ['apiKey', 'authDomain', 'projectId', 'messagingSenderId', 'appId'];
  const missingKeys = requiredKeys.filter(key => !firebaseConfig[key]);
  
  if (missingKeys.length > 0) {
    throw new Error(`Missing required Firebase config keys: ${missingKeys.join(', ')}`);
  }

  if (!fcmSettings.vapidKey) {
    throw new Error('Missing required VAPID key for FCM');
  }

  app = initializeApp(firebaseConfig);
  console.log(`${DEBUG_PREFIX} Firebase initialized successfully`);
} catch (error) {
  console.error(`${DEBUG_PREFIX} Firebase initialization failed:`, error);
  throw error;
}

export { app };

// Manage messaging instance with initialization delay
let messagingInstance: Messaging | null = null;
let initializationPromise: Promise<Messaging> | null = null;

export const getFirebaseMessaging = async (): Promise<Messaging> => {
  if (messagingInstance?.app) {
    return messagingInstance;
  }

  if (initializationPromise) {
    return initializationPromise;
  }

  initializationPromise = (async () => {
    try {
      // Ensure service worker is registered
      const registration = await navigator.serviceWorker.ready;
      console.log(`${DEBUG_PREFIX} Service worker ready for messaging:`, {
        state: registration.active?.state,
        scope: registration.scope
      });

      // Initialize messaging
      messagingInstance = getMessaging(app);
      
      // Wait for messaging to initialize with exponential backoff
      let retries = 0;
      const maxRetries = 3;
      const baseDelay = 500;

      while (retries < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, baseDelay * Math.pow(2, retries)));
        
        // Check if messaging is initialized
        if (messagingInstance) {
          try {
            // Perform a lightweight operation to verify the instance
            await getToken(messagingInstance, { vapidKey: fcmSettings.vapidKey }).catch(() => null);
            return messagingInstance;
          } catch (verifyError) {
            console.log(`${DEBUG_PREFIX} Verification attempt ${retries + 1} failed:`, verifyError);
          }
        }
        retries++;
      }

      throw new Error('Messaging initialization timeout after retries');
    } catch (error) {
      console.error(`${DEBUG_PREFIX} Failed to initialize messaging:`, error);
      messagingInstance = null;
      throw error;
    } finally {
      initializationPromise = null;
    }
  })();

  return initializationPromise;
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

  const deviceInfo = platform.getDeviceInfo();

  // Get subscription state using RPC function
  const { data: subscription } = await supabase
    .rpc('get_device_subscription', {
      p_user_id: userId,
      p_device_id: deviceId,
      p_browser_instance: platform.browserInstanceId
    });

  // If subscription exists, update it. If not, create new one.
  const { error } = await supabase
    .from('push_subscriptions')
    .upsert({
      user_id: userId,
      fcm_token: token,
      device_id: deviceId,
      device_name: `${deviceInfo.deviceBrand} ${deviceInfo.browserInfo}`,
      device_type: deviceInfo.deviceType,
      enabled: subscription?.enabled ?? true,
      browser_instance: platform.browserInstanceId,
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'user_id,device_id,browser_instance'
    });

  if (error) {
    console.error('Error updating FCM token:', error);
  } else {
    console.log('FCM token updated in database');
  }
};

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
          isMobile: isMobileDevice,
          vapidKey: fcmSettings.vapidKey
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
      messaging = await getFirebaseMessaging();
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
      serviceWorkerRegistration: registration,
      ...(deviceInfo.deviceType === 'android' ? fcmSettings.android : {}),
      ...(deviceInfo.deviceType === 'ios' ? fcmSettings.ios : {}),
      ...(deviceInfo.deviceType === 'web' ? fcmSettings.web : {})
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
        await new Promise(resolve => setTimeout(resolve, 1000));
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

      // Log token info
      console.log(`${DEBUG_PREFIX} Token generated:`, {
        tokenLength: currentToken.length,
        tokenPrefix: currentToken.substring(0, 8) + '...',
        deviceType: deviceInfo.deviceType
      });

      console.log(`${DEBUG_PREFIX} Token generated successfully:`, {
        tokenLength: currentToken.length,
        tokenPrefix: currentToken.substring(0, 8) + '...',
        deviceType: deviceInfo.deviceType
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
          const messaging = await getFirebaseMessaging();
          const newToken = await getToken(messaging, {
            vapidKey: fcmSettings.vapidKey,
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
      if (notification && !isMobileDevice) { // Only show notifications for desktop
        await showNotification(
          notification.title || 'New Message',
          {
            body: notification.body,
            data: payload.data,
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
          const messaging = await getFirebaseMessaging();
          const newToken = await getToken(messaging, {
            vapidKey: fcmSettings.vapidKey,
            serviceWorkerRegistration: registration
          });

          if (newToken && newToken !== currentToken) {
            await updateTokenInDatabase(userId, newToken);
            currentToken = newToken;
            console.log(`${DEBUG_PREFIX} Token updated after change event`);
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