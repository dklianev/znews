import React from 'react'
import ReactDOM from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App.jsx'
import './index.css'
import { installClientAssetMonitoring } from './utils/clientMonitoring'
import { showPwaOfflineToast, showPwaUpdateToast } from './utils/systemToasts'

const updateSW = registerSW({
  onRegisteredSW(_swUrl, registration) {
    if (!registration || typeof window === 'undefined') return
    if (window.__znSwUpdatePollingInstalled) return

    window.__znSwUpdatePollingInstalled = true

    const triggerUpdateCheck = () => {
      if (document.visibilityState === 'hidden') return
      registration.update().catch(() => {})
    }

    window.setInterval(triggerUpdateCheck, 60 * 60 * 1000)
    document.addEventListener('visibilitychange', triggerUpdateCheck)
  },
  onNeedRefresh() {
    showPwaUpdateToast(() => updateSW(true))
  },
  onOfflineReady() {
    showPwaOfflineToast()
  },
})

installClientAssetMonitoring()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
