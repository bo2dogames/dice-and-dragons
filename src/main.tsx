import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

const appBase = import.meta.env.BASE_URL.replace(/\/$/, '')
const basePage = appBase ? window.location.pathname === appBase || window.location.pathname === `${appBase}/` : window.location.pathname === '/'
if (!basePage) {
  const route = window.location.hash.slice(1)
    || `/${window.location.pathname.slice(appBase.length).replace(/^\/+/, '')}${window.location.search}`
  window.history.replaceState(null, '', `${appBase}/#${route.startsWith('/') ? route : `/${route}`}`)
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

