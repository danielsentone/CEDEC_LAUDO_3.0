import { createRoot } from 'react-dom/client';
import { App } from './App';
import React from 'react';
import './index.css';

console.log("[SYSTEM] index.tsx is running");

window.onerror = function(message, source, lineno, colno, error) {
  console.error("[SYSTEM] Global Error:", message, "at", source, ":", lineno, ":", colno);
  
  // Try to hide loader so user can see the error
  if (typeof window.hideLoader === 'function') {
    window.hideLoader();
  }

  const root = document.getElementById('root');
  if (root) {
    root.innerHTML = `<div style="padding: 20px; color: #f97316; background: #0f172a; min-height: 100vh; font-family: sans-serif;">
      <h2 style="border-bottom: 1px solid #334155; padding-bottom: 10px;">Erro Crítico no Frontend</h2>
      <p style="color: white;">Ocorreu um erro ao carregar a aplicação. Por favor, tente recarregar a página.</p>
      <div style="background: #1e293b; padding: 15px; border-radius: 4px; overflow: auto; margin-top: 20px;">
        <code style="color: #ef4444;">${message}</code>
        <pre style="color: #94a3b8; font-size: 12px; margin-top: 10px;">${error?.stack || ''}</pre>
      </div>
      <button onclick="window.location.reload(true)" style="margin-top: 20px; padding: 10px 20px; background: #f97316; border: none; border-radius: 4px; color: white; cursor: pointer; font-weight: bold;">Recarregar Agora</button>
    </div>`;
  }
};

const container = document.getElementById('root');
if (container) {
  try {
    console.log("[SYSTEM] Starting React render...");
    const root = createRoot(container);
    root.render(<App />);
  } catch (error) {
    console.error("[SYSTEM] Render Error:", error);
    if (typeof window.hideLoader === 'function') {
      window.hideLoader();
    }
    const loader = document.getElementById('loading-screen');
    if (loader) {
      loader.innerHTML = `<div style="color: white; text-align: center; padding: 20px;">
        <h2 style="color: #f97316;">Erro ao Iniciar App</h2>
        <p>${error instanceof Error ? error.message : String(error)}</p>
        <button onclick="window.location.reload()" style="margin-top: 10px; padding: 8px 16px; background: #f97316; border: none; border-radius: 4px; color: white; cursor: pointer;">Recarregar</button>
      </div>`;
    }
  }
}
