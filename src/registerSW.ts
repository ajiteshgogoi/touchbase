const isIOSInstagram = () => {
  const ua = navigator.userAgent;
  return /Instagram/.test(ua) && /iPhone|iPad|iPod/.test(ua);
};

export const registerServiceWorker = async () => {
  if (isIOSInstagram()) {
    console.log('Skipping service worker registration for iOS Instagram browser');
    return;
  }

  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('Service worker registered:', registration);
    } catch (error) {
      console.error('Service worker registration failed:', error);
    }
  }
};