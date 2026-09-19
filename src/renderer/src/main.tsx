import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { ActivityPage } from './pages/ActivityPage'
import './styles.css'

const root = document.getElementById('root')
if (!root) {
  throw new Error('Root element missing')
}

const hash = window.location.hash.replace(/^#/, '')
const page = hash === '/activity' ? <ActivityPage /> : <App />

createRoot(root).render(<StrictMode>{page}</StrictMode>)
