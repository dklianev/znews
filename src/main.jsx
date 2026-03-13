import React from 'react'
import ReactDOM from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App.jsx'
import './index.css'

function showPwaToast({
  className,
  message,
  actionLabel = '',
  onAction = null,
  dismissLabel = 'Dismiss',
}) {
  document.querySelector(`.${className}`)?.remove()

  const toast = document.createElement('div')
  toast.className = className

  const msg = document.createElement('span')
  msg.textContent = message
  toast.appendChild(msg)

  if (actionLabel && typeof onAction === 'function') {
    const actionButton = document.createElement('button')
    actionButton.className = 'pwa-refresh-btn'
    actionButton.textContent = actionLabel
    actionButton.addEventListener('click', () => {
      onAction()
      toast.remove()
    })
    toast.appendChild(actionButton)
  }

  const dismissBtn = document.createElement('button')
  dismissBtn.className = 'pwa-dismiss-btn'
  dismissBtn.textContent = '\u2715'
  dismissBtn.setAttribute('aria-label', dismissLabel)
  dismissBtn.addEventListener('click', () => {
    toast.remove()
  })
  toast.appendChild(dismissBtn)

  document.body.appendChild(toast)
}

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
    showPwaToast({
      className: 'pwa-update-toast',
      message: '\u0418\u043c\u0430 \u043d\u043e\u0432\u0430 \u0432\u0435\u0440\u0441\u0438\u044f \u043d\u0430 \u0441\u0430\u0439\u0442\u0430.',
      actionLabel: '\u041e\u0431\u043d\u043e\u0432\u0438',
      onAction: () => updateSW(true),
      dismissLabel: '\u0417\u0430\u0442\u0432\u043e\u0440\u0438',
    })
  },
  onOfflineReady() {
    showPwaToast({
      className: 'pwa-offline-toast',
      message: '\u0421\u0430\u0439\u0442\u044a\u0442 \u0435 \u0433\u043e\u0442\u043e\u0432 \u0438 \u0437\u0430 \u043e\u0444\u043b\u0430\u0439\u043d \u0440\u0435\u0436\u0438\u043c.',
      dismissLabel: '\u0417\u0430\u0442\u0432\u043e\u0440\u0438',
    })
  },
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
