import { useState, useEffect, useRef } from 'react'
import { getATMIV } from '../utils/api.js'
import { Line } from 'react-chartjs-2'
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler } from 'chart.js'
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler)

const MAX_POINTS = 200
const LS_KEY = 'iv_tracker_history'

function fmtD(ts) {
  const d = new Date(ts)
  return d.toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit', second:'2-digit' })
}

export default function TrackerPage() {
  const [asset, setAsset] = useState('BTC')
  const [history, setHistory] = useState(() => {
    try { return JSON.parse(localStorage.getItem(LS_KEY + '_BTC') || '[]') } catch { return [] }
  })
  const [running, setRunning] = useState(false)
  const [intervalSec, setIntervalSec] = useState(30)
  const [countdown, setCountdown] = useState(0)
  const [alertThreshold, setAlertThreshold] = useState(() => parseFloat(localStorage.getItem('iv_alert_threshold') || '0'))
  const [alertTriggered, setAlertTriggered] = useState(false)
  const [showAlertConfig, setShowAlertConfig] = useState(false)
  const timerRef = useRef(null)
  const countRef = useRef(null)

  const saveHistory = (h, a) => localStorage.setItem(LS_KEY + '_' + a, JSON.stringify(h.slice(-MAX_POINTS)))

  const fetchAndRecord = async (a) => {
    try {
      const data = await getATMIV(a)
      const point = { timestamp: new Date().toISOString(), ...data }
      setHistory(prev => {
        const next = [...prev, point].slice(-MAX_POINTS)
        saveHistory(next, a)
        // Vérifier alerte spike
        if (alertThreshold > 0 && data.iv >= alertThreshold) {
          setAlertTriggered(true)
        }
        return next
      })
    } catch(e) { console.warn('Tracker error:', e.message) }
  }

  const start = () => {
    setRunning(true)
    setAlertTriggered(false)
    fetchAndRecord(asset)
    timerRef.current = setInterval(() => fetchAndRecord(asset), intervalSec * 1000)
    setCountdown(intervalSec)
    countRef.current = setInterval(() => setCountdown(c => c <= 1 ? intervalSec : c - 1), 1000)
  }

  const stop = () => {
    setRunning(false)
    clearInterval(timerRef.current)
    clearInterval(countRef.current)
    timerRef.current = null
    setCountdown(0)
  }

  const switchAsset = (a) => {
    stop()
    setAsset(a)
    setAlertTriggered(false)
    try { setHistory(JSON.parse(localStorage.getItem(LS_KEY + '_' + a) || '[]')) } catch { setHistory([]) }
  }

  const saveAlert = (val) => {
    setAlertThreshold(val)
    localStorage.setItem('iv_alert_threshold', val)
    setAlertTriggered(false)
  }

  useEffect(() => () => { clearInterval(timerRef.current); clearInterval(countRef.current) }, [])

  const last = history[history.length - 1]
  const ivs  = history.map(r => r.iv).filter(Boolean)
  const ivMin = ivs.length ? Math.min(...ivs).toFixed(2) : '—'
  const ivMax = ivs.length ? Math.max(...ivs).toFixed(2) : '—'
  const ivAvg = ivs.length ? (ivs.reduce((a,b)=>a+b,0)/ivs.length).toFixed(2) : '—'

  // Détecter spike : IV actuelle > moyenne + 10%
  const ivNow = last?.iv ?? null
  const ivAvgNum = ivs.length ? ivs.reduce((a,b)=>a+b,0)/ivs.length : null
  const isSpiking = ivNow && ivAvgNum && ivNow > ivAvgNum * 1.1

  const chartData = {
    labels: history.map(r => fmtD(r.timestamp)),
    datasets: [
      {
        label: 'IV ATM',
        data: history.map(r => r.iv),
        borderColor: '#ffd700',
        backgroundColor: 'rgba(255,215,0,.08)',
        borderWidth: 2,
        pointRadius: 0,
        fill: true,
        tension: 0.3,
      },
      // Ligne seuil alerte
      ...(alertThreshold > 0 ? [{
        label: 'Seuil alerte',
        data: history.map(() => alertThreshold),
        borderColor: 'rgba(255,77,109,.6)',
        borderWidth: 1,
        borderDash: [4, 4],
        pointRadius: 0,
        fill: false,
        tension: 0,
      }] : [])
    ]
  }

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#0d1520', borderColor: '#1e3a5f', borderWidth: 1,
        titleColor: '#e8f4ff', bodyColor: '#6a8aaa',
        callbacks: { label: ctx => ctx.parsed.y?.toFixed(2) + '%' }
      }
    },
    scales: {
      x: { ticks: { color: '#3a5570', font: { size: 9 }, maxTicksLimit: 6 }, grid: { color: 'rgba(30,58,95,.3)' } },
      y: { ticks: { color: '#6a8aaa', font: { size: 9 }, callback: v => v.toFixed(1)+'%' }, grid: { color: 'rgba(30,58,95,.3)' } }
    }
  }

  const exportCSV = () => {
    if (!history.length) return
    const fields = ['timestamp', 'spot', 'iv', 'atmStrike']
    const csv = [fields.join(','), ...history.map(r => fields.map(k => r[k]??'').join(','))].join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    const a = document.createElement('a')
    a.href = url; a.download = `iv_live_${asset}_${new Date().toISOString().slice(0,16).replace('T','_')}.csv`
    a.click()
  }

  return (
    <div className="page-wrap">

      {/* Bannière alerte spike */}
      {alertTriggered && (
        <div style={{ background:'rgba(255,77,109,.15)', border:'1px solid var(--put)', borderRadius:10, padding:'12px 16px', marginBottom:16, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <div style={{ color:'var(--put)', fontFamily:'var(--sans)', fontWeight:800, fontSize:14 }}>🚨 IV Spike détecté !</div>
            <div style={{ color:'var(--text-dim)', fontSize:11, marginTop:2 }}>
              IV {ivNow?.toFixed(2)}% ≥ seuil {alertThreshold}% — Bon moment pour un contrat DI
            </div>
          </div>
          <button onClick={() => setAlertTriggered(false)} style={{ background:'none', border:'none', color:'var(--text-muted)', cursor:'pointer', fontSize:18 }}>✕</button>
        </div>
      )}

      {/* Bannière spike naturel (sans seuil défini) */}
      {isSpiking && !alertTriggered && (
        <div style={{ background:'rgba(255,215,0,.08)', border:'1px solid rgba(255,215,0,.3)', borderRadius:10, padding:'10px 16px', marginBottom:16 }}>
          <div style={{ color:'var(--atm)', fontFamily:'var(--sans)', fontWeight:700, fontSize:13 }}>
            ⚡ IV au-dessus de la moyenne — {ivNow?.toFixed(2)}% vs moy. {ivAvgNum?.toFixed(2)}%
          </div>
          <div style={{ color:'var(--text-muted)', fontSize:11, marginTop:2 }}>Volatilité élevée — taux DI potentiellement attractifs</div>
        </div>
      )}

      <div className="page-header">
        <div className="page-title">IV <span>Live</span></div>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <div className={`dot-live${running?'':' off'}`} />
          <span className="status-text">{running ? `${countdown}s` : 'Arrêté'}</span>
        </div>
      </div>

      <div className="controls-row">
        <div className="asset-toggle">
          <button className={`asset-btn${asset==='BTC'?' active-btc':''}`} onClick={() => switchAsset('BTC')}>₿ BTC</button>
          <button className={`asset-btn${asset==='ETH'?' active-eth':''}`} onClick={() => switchAsset('ETH')}>Ξ ETH</button>
        </div>
        <select style={{ background:'var(--surface)', border:'1px solid var(--border)', color:'var(--text)', padding:'7px 10px', borderRadius:8, fontSize:11, outline:'none' }}
          value={intervalSec} onChange={e => setIntervalSec(parseInt(e.target.value))}>
          <option value={10}>10s</option>
          <option value={30}>30s</option>
          <option value={60}>60s</option>
          <option value={300}>5min</option>
        </select>
        <button className="icon-btn"
          style={{ background: running?'rgba(255,77,109,.1)':'rgba(0,229,160,.1)', borderColor: running?'var(--put)':'var(--call)', color: running?'var(--put)':'var(--call)' }}
          onClick={running ? stop : start}>
          {running ? '⏸ Pause' : '▶ Start'}
        </button>
        <button className="icon-btn" onClick={exportCSV}>↓ CSV</button>
      </div>

      <div className="stats-grid">
        <div className="stat-card" style={isSpiking ? { borderColor:'rgba(255,215,0,.4)', background:'rgba(255,215,0,.04)' } : {}}>
          <div className="stat-label">IV ATM</div>
          <div className="stat-value gold">{ivNow?.toFixed(2) ?? '—'}%</div>
          {isSpiking && <div className="stat-sub" style={{ color:'var(--atm)' }}>⚡ spike</div>}
        </div>
        <div className="stat-card">
          <div className="stat-label">Spot</div>
          <div className="stat-value blue">{last?.spot ? '$'+last.spot.toLocaleString('en-US',{maximumFractionDigits:0}) : '—'}</div>
        </div>
        <div className="stat-card"><div className="stat-label">IV Min</div><div className="stat-value green">{ivMin !== '—' ? ivMin+'%' : '—'}</div></div>
        <div className="stat-card"><div className="stat-label">IV Max</div><div className="stat-value red">{ivMax !== '—' ? ivMax+'%' : '—'}</div></div>
        <div className="stat-card"><div className="stat-label">IV Moy.</div><div className="stat-value">{ivAvg !== '—' ? ivAvg+'%' : '—'}</div></div>
        <div className="stat-card"><div className="stat-label">Points</div><div className="stat-value">{history.length}</div></div>
      </div>

      {/* Config alerte */}
      <div className="card" style={{ marginBottom:12 }}>
        <div className="card-header" style={{ cursor:'pointer' }} onClick={() => setShowAlertConfig(v => !v)}>
          <span>🔔 Alerte IV spike</span>
          <span style={{ fontSize:11, color: alertThreshold > 0 ? 'var(--call)' : 'var(--text-muted)' }}>
            {alertThreshold > 0 ? `Seuil : ${alertThreshold}%` : 'Non configuré'} {showAlertConfig ? '▲' : '▼'}
          </span>
        </div>
        {showAlertConfig && (
          <div style={{ padding:'12px 16px', display:'flex', flexDirection:'column', gap:10 }}>
            <div style={{ fontSize:11, color:'var(--text-muted)', lineHeight:1.7 }}>
              Définissez un seuil d'IV. Quand l'IV ATM dépasse ce seuil, une alerte s'affiche — c'est le signal que les taux DI sont exceptionnellement attractifs.
            </div>
            <div style={{ display:'flex', gap:8, alignItems:'center' }}>
              <input
                type="number" step="1" min="0" max="500"
                placeholder="Ex: 80"
                defaultValue={alertThreshold || ''}
                style={{ flex:1, background:'var(--surface2)', border:'1px solid var(--border)', color:'var(--text)', padding:'8px 12px', borderRadius:8, fontFamily:'var(--mono)', fontSize:12, outline:'none' }}
                onChange={e => saveAlert(parseFloat(e.target.value) || 0)}
              />
              <span style={{ fontSize:12, color:'var(--text-muted)' }}>%</span>
              <button className="icon-btn" style={{ color:'var(--put)', borderColor:'rgba(255,77,109,.3)' }} onClick={() => saveAlert(0)}>
                Désactiver
              </button>
            </div>
            <div style={{ fontSize:10, color:'var(--text-muted)' }}>
              💡 L'IV BTC tourne souvent entre 50-70%. Un spike au-dessus de 80-90% est exceptionnel.
            </div>
            {/* Niveaux de référence rapide */}
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              {[60, 70, 80, 90, 100].map(v => (
                <button key={v} onClick={() => saveAlert(v)} style={{
                  padding:'4px 10px', borderRadius:20, fontSize:10, cursor:'pointer',
                  border: alertThreshold===v ? '1px solid var(--accent)' : '1px solid var(--border)',
                  background: alertThreshold===v ? 'rgba(0,212,255,.1)' : 'transparent',
                  color: alertThreshold===v ? 'var(--accent)' : 'var(--text-muted)',
                }}>{v}%</button>
              ))}
            </div>
          </div>
        )}
      </div>

      {history.length > 1 && (
        <div className="card" style={{ marginBottom:12 }}>
          <div className="card-header">
            IV ATM — {asset}
            {alertThreshold > 0 && <span style={{ fontSize:10, color:'rgba(255,77,109,.7)' }}>— seuil {alertThreshold}%</span>}
          </div>
          <div style={{ padding:'0 4px 12px', height:180 }}>
            <Line data={chartData} options={chartOptions} />
          </div>
        </div>
      )}

      {history.length === 0 && (
        <div className="empty-state"><div className="empty-icon">◇</div><h3>Aucune donnée</h3><p>Appuyez sur Start pour enregistrer l'IV en temps réel</p></div>
      )}

      {history.length > 0 && (
        <div className="card">
          <div className="card-header">
            <span>Historique récent</span>
            <button className="icon-btn" style={{ fontSize:10, padding:'3px 8px' }}
              onClick={() => { setHistory([]); localStorage.removeItem(LS_KEY+'_'+asset) }}>Effacer</button>
          </div>
          <div style={{ maxHeight:300, overflowY:'auto' }}>
            {[...history].reverse().slice(0,50).map((p, i) => (
              <div key={i} style={{
                padding:'8px 14px', borderBottom:'1px solid rgba(30,58,95,.3)',
                display:'flex', justifyContent:'space-between', fontSize:11,
                background: alertThreshold > 0 && p.iv >= alertThreshold ? 'rgba(255,77,109,.06)' : undefined
              }}>
                <span style={{ color:'var(--text-muted)' }}>{fmtD(p.timestamp)}</span>
                <span style={{ color: alertThreshold > 0 && p.iv >= alertThreshold ? 'var(--put)' : 'var(--atm)', fontWeight: alertThreshold > 0 && p.iv >= alertThreshold ? 700 : 400 }}>
                  {p.iv?.toFixed(2)}%
                  {alertThreshold > 0 && p.iv >= alertThreshold && ' 🚨'}
                </span>
                <span style={{ color:'var(--text-dim)' }}>${p.spot?.toLocaleString('en-US',{maximumFractionDigits:0})}</span>
                <span style={{ color:'var(--text-muted)', fontSize:10 }}>Strike {p.atmStrike?.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
