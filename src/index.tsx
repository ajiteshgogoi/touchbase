import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

const root = document.getElementById('root')!;

// Handle Instagram browser case
if (document.documentElement.getAttribute('data-ig-browser') === 'true' &&
    document.documentElement.getAttribute('data-ig-platform') === 'ios') {
  // For iOS Instagram, just show the banner that was created in the preload script
  // This prevents issues with module loading in Instagram's WebView
  root.innerHTML = '<div class="bg-gray-50 min-h-screen"></div>';
} else {
  // Normal initialization for all other browsers
  try {
    ReactDOM.createRoot(root).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  } catch (error) {
    console.error('Failed to initialize app:', error);
    // Fallback message if React fails to load
    root.innerHTML = '<div class="p-4">Unable to load application. Please try refreshing the page.</div>';
  }
}