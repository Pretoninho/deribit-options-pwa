import { useState, useEffect, useRef } from 'react'
import { getATMIV, getSpot, getInstruments, getOrderBook } from '../utils/api.js'
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
  const [interval, setIntervalSec] = useState(30)
  const [countdown, setCountdown] = useState(0)
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
        return next
      })
    } catch(e) { console.warn('Tracker error:', e.message) }
  }

  const start = () => {
    setRunning(true)
    fetchAndRecord(asset)
    timerRef.current = setInterval(() => fetchAndRecord(asset), interval * 1000)
    setCountdown(interval)
    countRef.current = setInterval(() => setCountdown(c => c <= 1 ? interval : c - 1), 1000)
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
    try { setHistory(JSON.parse(localStorage.getItem(LS_KEY + '_' + a) || '[]')) } catch { setHistory([]) }
  }

  useEffect(() => () => { clearInterval(timerRef.current); clearInterval(countRef.current) }, [])

  const last = history[history.length - 1]
  const ivs = history.map(r => r.iv).filter(Boolean)
  const ivMin = ivs.length ? Math.min(...ivs).toFixed(2) : '—'
  const ivMax = ivs.length ? Math.max(...ivs).toFixed(2) : '—'
  const ivAvg = ivs.length ? (ivs.reduce((a,b)=>a+b,0)/ivs.length).toFixed(2) : '—'

  const chartData = {
    labels: history.map(r => fmtD(r.timestamp)),
    datasets: [{
      label: 'IV ATM',
      data: history.map(r => r.iv),
      borderColor: '#ffd700',
      backgroundColor: 'rgba(255,215,0,.08)',
      borderWidth: 2,
      pointRadius: 0,
      fill: true,
      tension: 0.3,
    }]
  }

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#0d1520',
        borderColor: '#1e3a5f',
        borderWidth: 1,
        titleColor: '#e8f4ff',
        bodyColor: '#6a8aaa',
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
      <div className="page-header">
        <div className="page-title">IV <span>Live</span></div>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
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
          value={interval} onChange={e => setIntervalSec(parseInt(e.target.value))}>
          <option value={10}>10s</option>
          <option value={30}>30s</option>
          <option value={60}>60s</option>
          <option value={300}>5min</option>
        </select>
        <button className="icon-btn" style={{ background: running ? 'rgba(255,77,109,.1)' : 'rgba(0,229,160,.1)', borderColor: running ? 'var(--put)' : 'var(--call)', color: running ? 'var(--put)' : 'var(--call)' }}
          onClick={running ? stop : start}>
          {running ? '⏸ Pause' : '▶ Start'}
        </button>
        <button className="icon-btn" onClick={exportCSV}>↓ CSV</button>
      </div>

      <div className="stats-grid">
        <div className="stat-card"><div className="stat-label">IV ATM</div><div className="stat-value gold">{last?.iv?.toFixed(2)??'—'}%</div></div>
        <div className="stat-card"><div className="stat-label">Spot</div><div className="stat-value blue">{last?.spot?'$'+last.spot.toLocaleString('en-US',{maximumFractionDigits:0}):'—'}</div></div>
        <div className="stat-card"><div className="stat-label">IV Min</div><div className="stat-value green">{ivMin !== '—' ? ivMin+'%' : '—'}</div></div>
        <div className="stat-card"><div className="stat-label">IV Max</div><div className="stat-value red">{ivMax !== '—' ? ivMax+'%' : '—'}</div></div>
        <div className="stat-card"><div className="stat-label">IV Moy.</div><div className="stat-value">{ivAvg !== '—' ? ivAvg+'%' : '—'}</div></div>
        <div className="stat-card"><div className="stat-label">Points</div><div className="stat-value">{history.length}</div></div>
      </div>

      {history.length > 1 && (
        <div className="card" style={{ marginBottom:12 }}>
          <div className="card-header">IV ATM — {asset}</div>
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
            <button className="icon-btn" style={{ fontSize:10, padding:'3px 8px' }} onClick={() => { setHistory([]); localStorage.removeItem(LS_KEY+'_'+asset) }}>Effacer</button>
          </div>
          <div style={{ maxHeight:300, overflowY:'auto' }}>
            {[...history].reverse().slice(0,50).map((p, i) => (
              <div key={i} style={{ padding:'8px 14px', borderBottom:'1px solid rgba(30,58,95,.3)', display:'flex', justifyContent:'space-between', fontSize:11 }}>
                <span style={{ color:'var(--text-muted)' }}>{fmtD(p.timestamp)}</span>
                <span style={{ color:'var(--atm)' }}>{p.iv?.toFixed(2)}%</span>
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
