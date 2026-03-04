import { createRoot } from 'react-dom/client';
import { App } from './App';
import React from 'react';

// Unregister Service Worker to fix caching issues that might be blocking API calls
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const registration of registrations) {
      registration.unregister();
    }
  });
}

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);