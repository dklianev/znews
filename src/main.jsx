import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { registerSW } from 'virtual:pwa-register'

const updateSW = registerSW({
  onNeedRefresh() {
    // Non-blocking toast instead of window.confirm()
    const toast = document.createElement('div');
    toast.className = 'pwa-update-toast';
    toast.innerHTML = `
      <span>Налична е нова версия</span>
      <button id="pwa-refresh-btn">Презареди</button>
      <button id="pwa-dismiss-btn" aria-label="Затвори">\u2715</button>
    `;
    document.body.appendChild(toast);

    document.getElementById('pwa-refresh-btn')?.addEventListener('click', () => {
      updateSW(true);
      toast.remove();
    });
    document.getElementById('pwa-dismiss-btn')?.addEventListener('click', () => {
      toast.remove();
    });
  },
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
