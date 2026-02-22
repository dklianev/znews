import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { registerSW } from 'virtual:pwa-register'

const updateSW = registerSW({
  onNeedRefresh() {
    // Remove any existing toast first (prevents duplicates)
    document.querySelector('.pwa-update-toast')?.remove();

    // Non-blocking toast instead of window.confirm()
    const toast = document.createElement('div');
    toast.className = 'pwa-update-toast';

    const msg = document.createElement('span');
    msg.textContent = 'Налична е нова версия';

    const refreshBtn = document.createElement('button');
    refreshBtn.textContent = 'Презареди';
    refreshBtn.addEventListener('click', () => {
      updateSW(true);
      toast.remove();
    });

    const dismissBtn = document.createElement('button');
    dismissBtn.textContent = '\u2715';
    dismissBtn.setAttribute('aria-label', 'Затвори');
    dismissBtn.addEventListener('click', () => {
      toast.remove();
    });

    toast.append(msg, refreshBtn, dismissBtn);
    document.body.appendChild(toast);
  },
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
