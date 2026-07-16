import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
// @ts-ignore - virtual module handled by vite-plugin-pwa
import { registerSW } from 'virtual:pwa-register'

// Register PWA service worker for full offline support
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  registerSW({
    onNeedRefresh() {
      console.log("New content available, please reload the app.");
    },
    onOfflineReady() {
      console.log("App is cached and ready to work offline.");
    },
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
