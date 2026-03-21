import { useEffect, useState } from 'react'
import { version } from '../package.json'
import HomePage from './pages/HomePage.jsx'
import ChainPage from './pages/ChainPage.jsx'
import DualPage from './pages/DualPage.jsx'
import SignalPage from './pages/SignalPage.jsx'
import VolPage from './pages/VolPage.jsx'
import OptionsPage from './pages/OptionsPage.jsx'
import PaperTradingPage from './pages/PaperTradingPage.jsx'
import './App.css'

// ── DI sub-tabs (Dual + Chaîne uniquement) ──
const DI_TABS = [
  { id:'dual', label:'Dual', icon:(
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
    </svg>
  )},
  { id:'chain', label:'Chaîne', icon:(
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
      <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
    </svg>
  )},
]

// ── Main nav tabs ──
const MAIN_TABS = [
  { id:'home', label:'Accueil', icon:(
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  )},
  { id:'vol', label:'Vol IV', icon:(
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
    </svg>
  )},
  { id:'signal', label:'Signal', icon:(
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
    </svg>
  )},
  { id:'di', label:'DI', icon:(
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
    </svg>
  )},
  { id:'paper', label:'Paper', icon:(
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
      <line x1="8" y1="21" x2="16" y2="21"/>
      <line x1="12" y1="17" x2="12" y2="21"/>
    </svg>
  )},
]

export default function App() {
  const [view, setView] = useState('home')
  const [diTab, setDiTab] = useState('dual')
  const [paperPrefill, setPaperPrefill] = useState(null)

  useEffect(() => {
    const url = new URL(window.location.href)
    const targetView = url.searchParams.get('view')
    if (!targetView) return
    const map = {
      signal: 'signal',
      vol: 'vol',
      dual: 'di',
      chain: 'di',
      di: 'di',
    }
    const mapped = map[targetView]
    if (mapped) {
      setView(mapped)
      if (targetView === 'chain') setDiTab('chain')
      if (targetView === 'dual')  setDiTab('dual')
    }
  }, [])

  const forceUpdate = () => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(regs => {
        regs.forEach(r => r.unregister())
        window.location.reload(true)
      })
    } else {
      window.location.reload(true)
    }
  }

  const openPaperTrading = (prefill = null) => {
    setPaperPrefill(prefill)
    setView('paper')
  }

  const navigate = (target) => {
    if (target === 'paper') { openPaperTrading(); return }
    setView(target)
  }

  // ── HOME ──
  if (view === 'home') {
    return <HomePage onNavigate={navigate} />
  }

  // ── VOL ──
  if (view === 'vol') {
    return (
      <div className="app-shell">
        <div className="app-content">
          <VolPage />
        </div>
        <MainNav view={view} setView={setView} forceUpdate={forceUpdate} />
        <VersionBar version={version} />
      </div>
    )
  }

  // ── SIGNAL ──
  if (view === 'signal') {
    return (
      <div className="app-shell">
        <div className="app-content">
          <SignalPage />
        </div>
        <MainNav view={view} setView={setView} forceUpdate={forceUpdate} />
        <VersionBar version={version} />
      </div>
    )
  }

  // ── DI SUITE (Dual + Chaîne) ──
  if (view === 'di') {
    return (
      <div className="app-shell">
        <div className="app-content">
          {diTab === 'dual'  && <DualPage />}
          {diTab === 'chain' && <ChainPage onNavigate={setView} onSubscribe={openPaperTrading} />}
        </div>
        {/* DI sub-nav */}
        <nav style={{ display:'flex', background:'var(--surface)', borderTop:'1px solid var(--border)', flexShrink:0 }}>
          {DI_TABS.map(t => (
            <button key={t.id} className={`nav-btn${diTab===t.id?' active':''}`} onClick={() => setDiTab(t.id)}>
              <span className="nav-icon">{t.icon}</span>
              <span className="nav-label">{t.label}</span>
            </button>
          ))}
        </nav>
        <MainNav view={view} setView={setView} forceUpdate={forceUpdate} />
        <VersionBar version={version} />
      </div>
    )
  }

  // ── PAPER TRADING ──
  if (view === 'paper') {
    return (
      <div className="app-shell">
        <div className="app-content">
          <PaperTradingPage onBack={() => setView('home')} prefillTrade={paperPrefill} />
        </div>
        <MainNav view={view} setView={setView} forceUpdate={forceUpdate} />
        <VersionBar version={version} />
      </div>
    )
  }

  // ── OPTIONS (placeholder, accessible via onNavigate) ──
  return <OptionsPage onBack={() => setView('home')} onNavigate={setView} />
}

function MainNav({ view, setView, forceUpdate }) {
  return (
    <nav className="bottom-nav">
      {MAIN_TABS.map(t => (
        <button
          key={t.id}
          className={`nav-btn${view === t.id ? ' active' : ''}`}
          onClick={() => setView(t.id)}
        >
          <span className="nav-icon">{t.icon}</span>
          <span className="nav-label">{t.label}</span>
        </button>
      ))}
      <button onClick={forceUpdate} style={{
        display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
        gap:2, padding:'6px 8px', background:'none', border:'none', cursor:'pointer',
        color:'var(--text-muted)', fontSize:9, fontFamily:'var(--sans)', fontWeight:700, opacity:.7
      }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M1 4v6h6M23 20v-6h-6"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/>
        </svg>
        MAJ
      </button>
    </nav>
  )
}

function VersionBar({ version }) {
  return (
    <div style={{ textAlign:'center', fontSize:9, color:'var(--text-muted)', opacity:.4, paddingBottom:4, letterSpacing:'1px' }}>
      v{version}
    </div>
  )
}
