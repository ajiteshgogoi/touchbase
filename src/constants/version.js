// Application version management
export const APP_VERSION = '2.4';

// Helper to get full version string
export const getFullVersion = () => {
  return `v${APP_VERSION}`;
};

// Helper to get cache version string
export const getCacheVersion = () => {
  return `touchbase-v${APP_VERSION}`;
};