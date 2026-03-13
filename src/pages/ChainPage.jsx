import { useState, useEffect } from 'react'
import { getSpot, getInstruments, getOrderBook, getAllExpiries } from '../utils/api.js'

function fmtTs(ts) {
  const d = new Date(ts)
  return d.toLocaleDateString('fr-FR', { day:'2-digit', month:'short', year:'2-digit' }).toUpperCase()
}

export default function ChainPage() {
  const [asset, setAsset] = useState('BTC')
  const [instruments, setInstruments] = useState([])
  const [expiries, setExpiries] = useState([])
  const [selExpiry, setSelExpiry] = useState(null)
  const [rows, setRows] = useState([])
  const [spot, setSpot] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [stats, setStats] = useState(null)

  const loadExpiries = async (a) => {
    setLoading(true); setError(null)
    try {
      const [sp, inst] = await Promise.all([getSpot(a), getInstruments(a)])
      setSpot(sp)
      setInstruments(inst)
      const exps = getAllExpiries(inst)
      setExpiries(exps)
      if (exps.length) { setSelExpiry(exps[0]); await loadChain(a, exps[0], inst, sp) }
    } catch(e) { setError(e.message) }
    setLoading(false)
  }

  const loadChain = async (a, expiryTs, inst, sp) => {
    const forExp = inst.filter(i => i.expiration_timestamp === expiryTs)
    const strikes = [...new Set(forExp.map(i => i.strike))].sort((x,y)=>x-y)
    const spotNow = sp || spot
    const BATCH = 8
    const allRows = []
    for (let i = 0; i < strikes.length; i += BATCH) {
      const batch = strikes.slice(i, i + BATCH)
      const batchRows = await Promise.all(batch.map(async strike => {
        const callInst = forExp.find(x => x.option_type==='call' && x.strike===strike)
        const putInst = forExp.find(x => x.option_type==='put' && x.strike===strike)
        const [cb, pb] = await Promise.all([
          callInst ? getOrderBook(callInst.instrument_name).catch(()=>null) : Promise.resolve(null),
          putInst ? getOrderBook(putInst.instrument_name).catch(()=>null) : Promise.resolve(null),
        ])
        return { strike, call: cb, put: pb }
      }))
      allRows.push(...batchRows)
    }
    setRows(allRows)
    // Stats
    const callIVs = allRows.map(r=>r.call?.mark_iv).filter(Boolean)
    const putIVs = allRows.map(r=>r.put?.mark_iv).filter(Boolean)
    const atmRow = spotNow ? allRows.reduce((p,c)=>Math.abs(c.strike-spotNow)<Math.abs(p.strike-spotNow)?c:p, allRows[0]) : null
    setStats({
      callIV: callIVs.length ? (callIVs.reduce((a,b)=>a+b,0)/callIVs.length).toFixed(1) : '—',
      putIV: putIVs.length ? (putIVs.reduce((a,b)=>a+b,0)/putIVs.length).toFixed(1) : '—',
      atmIV: atmRow?.call?.mark_iv?.toFixed(1) || atmRow?.put?.mark_iv?.toFixed(1) || '—',
      atmStrike: atmRow?.strike,
      contracts: allRows.length,
    })
  }

  useEffect(() => { loadExpiries(asset) }, [asset])

  const switchExpiry = async (ts) => {
    setSelExpiry(ts); setLoading(true)
    try { await loadChain(asset, ts, instruments, spot) }
    catch(e) { setError(e.message) }
    setLoading(false)
  }

  const fmt = n => n != null ? n.toFixed(2) : '—'
  const fmtK = n => n != null ? (n >= 1000 ? (n/1000).toFixed(1)+'K' : n.toFixed(0)) : '—'

  return (
    <div className="page-wrap">
      <div className="page-header">
        <div className="page-title">Chaîne <span>Options</span></div>
        <div style={{ display:'flex', gap:6, alignItems:'center' }}>
          {spot && <div className="price-pill"><span className="price-label">{asset}</span><span className="price-value">${spot.toLocaleString('en-US',{maximumFractionDigits:0})}</span></div>}
          <button className={`icon-btn${loading?' loading':''}`} onClick={() => loadExpiries(asset)}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M1 4v6h6M23 20v-6h-6"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/></svg>
          </button>
        </div>
      </div>

      <div className="asset-toggle" style={{ marginBottom:12 }}>
        <button className={`asset-btn${asset==='BTC'?' active-btc':''}`} onClick={() => setAsset('BTC')}>₿ BTC</button>
        <button className={`asset-btn${asset==='ETH'?' active-eth':''}`} onClick={() => setAsset('ETH')}>Ξ ETH</button>
      </div>

      {error && <div className="error-box">⚠ {error}</div>}

      {stats && (
        <div className="stats-grid" style={{ gridTemplateColumns:'repeat(2,1fr)', marginBottom:12 }}>
          <div className="stat-card"><div className="stat-label">IV ATM</div><div className="stat-value gold">{stats.atmIV}%</div>{stats.atmStrike&&<div className="stat-sub">Strike {stats.atmStrike?.toLocaleString()}</div>}</div>
          <div className="stat-card"><div className="stat-label">Contrats</div><div className="stat-value blue">{stats.contracts}</div></div>
          <div className="stat-card"><div className="stat-label">IV moy. Calls</div><div className="stat-value green">{stats.callIV}%</div></div>
          <div className="stat-card"><div className="stat-label">IV moy. Puts</div><div className="stat-value orange">{stats.putIV}%</div></div>
        </div>
      )}

      <div className="expiry-chips">
        {expiries.slice(0,10).map(ts => (
          <button key={ts} className={`expiry-chip${selExpiry===ts?' active':''}`} onClick={() => switchExpiry(ts)}>
            {fmtTs(ts)}
          </button>
        ))}
      </div>

      {loading && rows.length === 0 && (
        <div className="card"><div style={{ padding:20, textAlign:'center', color:'var(--text-muted)', fontSize:12 }}>Chargement…</div></div>
      )}

      {rows.length > 0 && (
        <div className="card">
          <div className="card-header" style={{ fontSize:10, padding:'8px 12px' }}>
            <span style={{ color:'var(--call)' }}>CALLS</span>
            <span style={{ color:'var(--atm)' }}>STRIKE</span>
            <span style={{ color:'var(--put)' }}>PUTS</span>
          </div>
          {/* Mobile: compact card per strike */}
          <div>
            {rows.map(({ strike, call, put }) => {
              const isATM = stats?.atmStrike === strike
              return (
                <div key={strike} style={{
                  padding:'10px 14px',
                  borderBottom:'1px solid rgba(30,58,95,.4)',
                  background: isATM ? 'rgba(255,215,0,.04)' : undefined,
                  borderLeft: isATM ? '2px solid var(--atm)' : '2px solid transparent',
                }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                    <span style={{ fontFamily:'var(--sans)', fontWeight:800, fontSize:14, color: isATM?'var(--atm)':'var(--text)' }}>
                      ${strike.toLocaleString()}
                      {isATM && <span style={{ fontSize:9, marginLeft:6, color:'var(--atm)', opacity:.7 }}>ATM</span>}
                    </span>
                    <div style={{ display:'flex', gap:16, fontSize:11 }}>
                      <span style={{ color:'var(--call)' }}>C: {fmt(call?.mark_iv)}%</span>
                      <span style={{ color:'var(--put)' }}>P: {fmt(put?.mark_iv)}%</span>
                    </div>
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:'var(--text-muted)' }}>
                    <span>OI: <span style={{ color:'var(--call)' }}>{fmtK(call?.open_interest)}</span> / <span style={{ color:'var(--put)' }}>{fmtK(put?.open_interest)}</span></span>
                    <span>Δ: <span style={{ color:'var(--call)' }}>{fmt(call?.greeks?.delta)}</span> / <span style={{ color:'var(--put)' }}>{fmt(put?.greeks?.delta)}</span></span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {!loading && rows.length === 0 && !error && (
        <div className="empty-state"><div className="empty-icon">◇</div><h3>Prêt à charger</h3><p>Appuyez sur actualiser</p></div>
      )}
    </div>
  )
}
