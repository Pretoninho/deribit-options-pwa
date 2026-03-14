import { useState } from 'react'
import ChainPage from './pages/ChainPage.jsx'
import TrackerPage from './pages/TrackerPage.jsx'
import DualPage from './pages/DualPage.jsx'
import TermPage from './pages/TermPage.jsx'
import PerfPage from './pages/PerfPage.jsx'
import './App.css'

const TABS = [
  { id: 'chain', label: 'Chaîne', icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
      <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
    </svg>
  )},
  { id: 'tracker', label: 'IV Live', icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
    </svg>
  )},
  { id: 'dual', label: 'Dual', icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
    </svg>
  )},
  { id: 'term', label: 'Basis', icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
      <line x1="2" y1="20" x2="22" y2="20"/>
    </svg>
  )},
  { id: 'perf', label: 'Perf', icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="18" y1="20" x2="18" y2="10"/>
      <line x1="12" y1="20" x2="12" y2="4"/>
      <line x1="6" y1="20" x2="6" y2="14"/>
    </svg>
  )},
]

export default function App() {
  const [active, setActive] = useState('dual')

  return (
    <div className="app-shell">
      <div className="app-content">
        {active === 'chain'   && <ChainPage />}
        {active === 'tracker' && <TrackerPage />}
        {active === 'dual'    && <DualPage />}
        {active === 'term'    && <TermPage />}
        {active === 'perf'    && <PerfPage />}
      </div>
      <nav className="bottom-nav">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`nav-btn${active === t.id ? ' active' : ''}`}
            onClick={() => setActive(t.id)}
          >
            <span className="nav-icon">{t.icon}</span>
            <span className="nav-label">{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
