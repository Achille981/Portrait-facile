import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Offline support is progressive enhancement; the editor remains usable without it.
    })
  })
} else if ('serviceWorker' in navigator) {
  void navigator.serviceWorker.getRegistrations().then((registrations) =>
    Promise.all(registrations.map((registration) => registration.unregister())))
    .catch((error) => console.error('Could not clear development service workers', error))
}
