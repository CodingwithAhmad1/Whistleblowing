import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { App } from './App'
import './index.css'

const rootEl = document.getElementById('root')
if (!rootEl) {
  document.body.innerHTML = '<div style="padding:2rem;font-family:system-ui">Cannot find #root. Check index.html.</div>'
} else {
  try {
    createRoot(rootEl).render(
      <StrictMode>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </StrictMode>,
    )
  } catch (err) {
    rootEl.innerHTML = `<div style="padding:2rem;font-family:system-ui;color:#b91c1c">
      <h2>Failed to start app</h2>
      <pre>${err instanceof Error ? err.message : String(err)}</pre>
    </div>`
  }
}
