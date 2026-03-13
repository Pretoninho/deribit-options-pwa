import { useState } from 'react'
import { getSpot, getFutures, getFuturePrice } from '../utils/api.js'
import { Bar } from 'react-chartjs-2'
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip } from 'chart.js'
ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip)

export default function TermPage() {
  const [asset, setAsset] = useState('BTC')
  const [rows, setRows] = useState([])
  const [spot, setSpot] = useState(null)
  const [signal, setSignal] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const load = async () => {
    setLoading(true); setError(null)
    try {
      const [sp, futures] = await Promise.all([getSpot(asset), getFutures(asset)])
      setSpot(sp)

      // Fetch prices sequentially
      const rowData = []
      for (const f of futures) {
        try {
          const price = await getFuturePrice(f.instrument_name)
          if (!price) continue
          const isPerp = f.instrument_name.includes('PERPETUAL')
          const days = isPerp ? null : Math.max(1, Math.round((f.expiration_timestamp - Date.now()) / 86400000))
          const basisBrut = (price - sp) / sp * 100
          const basisAnn = isPerp ? null : basisBrut / days * 365
          rowData.push({
            instrument: f.instrument_name,
            expiry: isPerp ? 'PERP' : new Date(f.expiration_timestamp).toLocaleDateString('fr-FR',{day:'2-digit',month:'short',year:'2-digit'}).toUpperCase(),
            days, price, basisBrut, basisAnn, isPerp,
          })
        } catch(_) {}
      }
      rowData.sort((a,b) => (a.days||9999) - (b.days||9999))
      setRows(rowData)

      // Signal
      const dated = rowData.filter(r => !r.isPerp && r.basisAnn != null)
      if (dated.length) {
        const avg = dated.reduce((s,r)=>s+r.basisAnn,0)/dated.length
        const max = Math.max(...dated.map(r=>r.basisAnn))
        const cls = avg > 0.5 ? 'green' : avg < -0.5 ? 'red' : 'orange'
        const label = avg > 0.5 ? 'Contango' : avg < -0.5 ? 'Backwardation' : 'Flat'
        setSignal({ label, cls, avg, max, count: dated.length })
      }
    } catch(e) { setError(e.message) }
    setLoading(false)
  }

  const dated = rows.filter(r => !r.isPerp)
  const chartData = {
    labels: dated.map(r => r.expiry),
    datasets: [{
      data: dated.map(r => r.basisAnn?.toFixed(3)),
      backgroundColor: dated.map(r => r.basisAnn >= 0 ? 'rgba(0,229,160,.8)' : 'rgba(255,77,109,.8)'),
      borderRadius: 4,
    }]
  }
  const chartOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display:false }, tooltip: { backgroundColor:'#0d1520', borderColor:'#1e3a5f', borderWidth:1, callbacks: { label: ctx => (ctx.parsed.y>0?'+':'')+ctx.parsed.y+'% ann.' } } },
    scales: {
      x: { ticks: { color:'#6a8aaa', font:{ size:9 } }, grid: { color:'rgba(30,58,95,.3)' } },
      y: { ticks: { color:'#6a8aaa', font:{ size:9 }, callback: v=>(v>0?'+':'')+v+'%' }, grid: { color:'rgba(30,58,95,.3)' } }
    }
  }

  const cls2color = { green:'var(--call)', red:'var(--put)', orange:'var(--accent2)' }

  return (
    <div className="page-wrap">
      <div className="page-header">
        <div className="page-title">Term <span>Structure</span></div>
        <div style={{ display:'flex', gap:6, alignItems:'center' }}>
          {spot && <span style={{ fontSize:12, color:'var(--atm)', fontFamily:'var(--sans)', fontWeight:800 }}>${spot.toLocaleString('en-US',{maximumFractionDigits:0})}</span>}
          <button className={`icon-btn${loading?' loading':''}`} onClick={load}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M1 4v6h6M23 20v-6h-6"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/></svg>
            Charger
          </button>
        </div>
      </div>

      <div className="asset-toggle" style={{ marginBottom:16 }}>
        <button className={`asset-btn${asset==='BTC'?' active-btc':''}`} onClick={() => { setAsset('BTC'); setRows([]); setSignal(null) }}>₿ BTC</button>
        <button className={`asset-btn${asset==='ETH'?' active-eth':''}`} onClick={() => { setAsset('ETH'); setRows([]); setSignal(null) }}>Ξ ETH</button>
      </div>

      {error && <div className="error-box">⚠ {error}</div>}

      {signal && (
        <div className="stats-grid">
          <div className="stat-card" style={{ borderColor: signal.cls==='green'?'rgba(0,229,160,.3)':signal.cls==='red'?'rgba(255,77,109,.3)':'rgba(255,107,53,.3)' }}>
            <div className="stat-label">Structure</div>
            <div className="stat-value" style={{ color: cls2color[signal.cls] }}>{signal.label}</div>
          </div>
          <div className="stat-card"><div className="stat-label">Basis moy. ann.</div><div className="stat-value" style={{ color:signal.avg>0?'var(--call)':signal.avg<0?'var(--put)':'var(--accent2)' }}>{signal.avg>0?'+':''}{signal.avg.toFixed(3)}%</div></div>
          <div className="stat-card"><div className="stat-label">Basis max ann.</div><div className="stat-value">{signal.max>0?'+':''}{signal.max.toFixed(3)}%</div></div>
          <div className="stat-card"><div className="stat-label">Futures actifs</div><div className="stat-value">{signal.count}</div></div>
        </div>
      )}

      {dated.length > 0 && (
        <div className="card" style={{ marginBottom:12 }}>
          <div className="card-header">Basis annualisé par expiration (%)</div>
          <div style={{ padding:'4px 8px 16px', height:200 }}>
            <Bar data={chartData} options={chartOptions} />
          </div>
        </div>
      )}

      {rows.length > 0 && (
        <div className="card">
          <div className="card-header">Détail par expiration</div>
          {rows.map(r => (
            <div key={r.instrument} style={{ padding:'10px 14px', borderBottom:'1px solid rgba(30,58,95,.3)', display:'grid', gridTemplateColumns:'1fr auto', gap:8 }}>
              <div>
                <div style={{ fontFamily:'var(--sans)', fontWeight:700, fontSize:12, color:'var(--text)' }}>{r.instrument}</div>
                <div style={{ fontSize:10, color:'var(--text-muted)', marginTop:2 }}>
                  {r.expiry} {r.days ? `• ${r.days}j` : ''}
                </div>
              </div>
              <div style={{ textAlign:'right' }}>
                {r.basisAnn != null ? (
                  <div style={{ fontFamily:'var(--sans)', fontWeight:700, fontSize:13, color: r.basisAnn>0.5?'var(--call)':r.basisAnn<-0.5?'var(--put)':'var(--accent2)' }}>
                    {r.basisAnn>0?'+':''}{r.basisAnn.toFixed(3)}%
                  </div>
                ) : <div style={{ fontSize:11, color:'var(--text-muted)' }}>Funding</div>}
                <div style={{ fontSize:10, color:'var(--text-muted)' }}>
                  {r.basisAnn==null ? '' : r.basisAnn>0.5?'Contango':r.basisAnn<-0.5?'Backwardation':'Flat'}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && rows.length === 0 && !error && (
        <div className="empty-state"><div className="empty-icon">◇</div><h3>Prêt à charger</h3><p>Sélectionnez un actif et appuyez sur Charger</p></div>
      )}
    </div>
  )
}
