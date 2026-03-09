import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

const App = lazy(() => import('./App.tsx'))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Suspense fallback={<div style={{ padding: 16, color: '#d7e3f4', fontFamily: 'system-ui, sans-serif' }}>Loading Brew Station...</div>}>
      <App />
    </Suspense>
  </StrictMode>,
)
