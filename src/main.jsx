import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

if (typeof window !== 'undefined') {
  import('./runtime/installRuntimeIntegrations.js')
    .then(({ installRuntimeIntegrations }) => installRuntimeIntegrations())
    .catch((error) => {
      console.error('Failed to install runtime integrations.', error)
    })
}
