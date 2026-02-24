import { createRoot } from 'react-dom/client';
import { App } from './App';
import React from 'react';

// Register Service Worker for Offline Support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Utiliza caminho relativo simples. O navegador resolverá isso em relação ao index.html (origem correta),
    // e não em relação à localização do script JS (que pode estar em um CDN/host diferente no preview).
    navigator.serviceWorker.register('./sw.js')
      .then(registration => {
        console.log('SW registered: ', registration);
      })
      .catch(registrationError => {
        console.log('SW registration failed: ', registrationError);
      });
  });
}

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);