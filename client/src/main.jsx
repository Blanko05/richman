import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import ThemeLab from './theme-lab/ThemeLab.jsx'

// Hidden dev entry point for the board-theme testing sandbox -- visit
// ?lab=1 to compare candidate visual themes against the same mock data,
// entirely separate from the real socket-driven game. Decided here, before
// App ever mounts, so it's a clean alternate root rather than a conditional
// early-return inside App (which would risk a Rules-of-Hooks violation).
const isLab = new URLSearchParams(window.location.search).has('lab')

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {isLab ? <ThemeLab /> : <App />}
  </StrictMode>,
)
