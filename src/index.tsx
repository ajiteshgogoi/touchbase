import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

const root = document.getElementById('root')!;

// Skip rendering entirely for iOS Instagram browser
if (document.documentElement.getAttribute('data-ig-browser') === 'true' &&
    document.documentElement.getAttribute('data-ig-platform') === 'ios') {
  // Remove root element since we're showing the overlay
  root.remove();
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
    // Fallback message if React fails to load //
    root.innerHTML = '<div class="p-4">Unable to load application. Please try refreshing the page.</div>';
  }
}