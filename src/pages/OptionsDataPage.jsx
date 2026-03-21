/**
 * OptionsDataPage — Vue options complète
 *
 * DVOL, IV term structure, skew 25-delta, greeks,
 * vol réalisée vs implicite, données Binance options.
 */
import { useState, useEffect, useRef } from 'react'
import * as deribit from '../data_core/providers/deribit.js'
import * as binance from '../data_core/providers/binance.js'
import { analyzeIV } from '../data_processing/volatility/iv_rank.js'
import { calcSkew25d, interpretSkew } from '../data_processing/volatility/skew.js'
import { calcOptionGreeks } from '../data_processing/volatility/greeks.js'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtPure(n, d = 2) {
  return Number.isFinite(n) ? n.toFixed(d) : '—'
}

function fmtPct(n, d = 2) {
  return Number.isFinite(n) ? n.toFixed(d) + '%' : '—'
}

function daysUntil(ts) {
  return Math.max(0.01, (ts - Date.now()) / 86400000)
}

// Trouve le strike ATM le plus proche du spot
function findATMStrike(options, spot) {
  if (!options?.length || !spot) return null
  return options.reduce((best, o) => {
    if (!best) return o
    return Math.abs(o.strike - spot) < Math.abs(best.strike - spot) ? o : best
  }, null)
}

// Regroupe les options par échéance
function groupByExpiry(options) {
  const map = {}
  for (const o of options) {
    const key = o.expiry
    if (!map[key]) map[key] = { expiry: o.expiry, daysToExpiry: o.daysToExpiry, calls: [], puts: [] }
    if (o.optionType === 'call') map[key].calls.push(o)
    else map[key].puts.push(o)
  }
  return Object.values(map).sort((a, b) => a.expiry - b.expiry)
}

// ── Composants ────────────────────────────────────────────────────────────────

function MetricCard({ label, value, sub, color, bar }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px' }}>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--sans)', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 20, color: color || 'var(--text)' }}>
        {value}
      </div>
      {bar != null && (
        <div style={{ height: 4, background: 'rgba(255,255,255,.06)', borderRadius: 2, overflow: 'hidden', marginTop: 6 }}>
          <div style={{ height: '100%', width: `${Math.min(100, Math.max(0, bar))}%`, background: color || 'var(--accent)', borderRadius: 2, transition: 'width .4s' }} />
        </div>
      )}
      {sub && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

function SectionTitle({ children, badge }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, marginTop: 20 }}>
      <div style={{
        fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--sans)',
        fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase',
      }}>
        {children}
      </div>
      {badge && (
        <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: 'rgba(0,212,255,.12)', color: 'var(--accent)' }}>
          {badge}
        </span>
      )}
    </div>
  )
}

// Sparkline DVOL sur les 72 dernières heures
function DvolSparkline({ history }) {
  if (!history?.length) return null
  const W = 260, H = 40, pad = 4
  const vals = history.map(h => h[1]).filter(Number.isFinite)
  if (vals.length < 2) return null
  const minV = Math.min(...vals), maxV = Math.max(...vals)
  const range = maxV - minV || 1
  const points = vals.map((v, i) => {
    const x = pad + (i / (vals.length - 1)) * (W - pad * 2)
    const y = H - pad - ((v - minV) / range) * (H - pad * 2)
    return `${x},${y}`
  }).join(' ')
  return (
    <svg width={W} height={H} style={{ display: 'block', maxWidth: '100%' }}>
      <polyline points={points} fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
}

// ── Page principale ───────────────────────────────────────────────────────────

export default function OptionsDataPage({ asset }) {
  const [spot,         setSpot]         = useState(null)
  const [dvol,         setDvol]         = useState(null)
  const [rv,           setRv]           = useState(null)
  const [termStructure,setTermStructure]= useState([])   // [{expiry, daysToExpiry, atmIV, callIV25d, putIV25d, skew}]
  const [greeks,       setGreeks]       = useState(null)
  const [ivAnalysis,   setIvAnalysis]   = useState(null)
  const [binOpts,      setBinOpts]      = useState(null)
  const [binOI,        setBinOI]        = useState(null)
  const [loading,      setLoading]      = useState(false)
  const [lastUpdate,   setLastUpdate]   = useState(null)
  const isMounted = useRef(true)

  useEffect(() => {
    isMounted.current = true
    load()
    const timer = setInterval(() => { if (isMounted.current) load() }, 60_000)
    return () => { isMounted.current = false; clearInterval(timer) }
  }, [asset])

  const load = async () => {
    setLoading(true)
    try {
      // Données de base
      const [spotRes, dvolRes, rvRes, binOptRes, binOIRes] = await Promise.allSettled([
        deribit.getSpot(asset),
        deribit.getDVOL(asset),
        deribit.getRealizedVol(asset),
        binance.getOptionsChain(asset),
        binance.getOptionsOI(asset),
      ])

      const spotData = spotRes.status  === 'fulfilled' ? spotRes.value  : null
      const dvolData = dvolRes.status  === 'fulfilled' ? dvolRes.value  : null
      const rvData   = rvRes.status    === 'fulfilled' ? rvRes.value    : null
      const spotPrice = spotData?.price ?? null

      if (!isMounted.current) return
      setSpot(spotData)
      setDvol(dvolData)
      setRv(rvData)
      setBinOpts(binOptRes.status === 'fulfilled' ? binOptRes.value : null)
      setBinOI(  binOIRes.status  === 'fulfilled' ? binOIRes.value  : null)

      // IV Rank / percentile sur 30j DVOL
      if (dvolData) {
        const history30 = dvolData.history.map(h => h[1])
        const ivRankData = analyzeIV(dvolData.current, history30)
        if (isMounted.current) setIvAnalysis(ivRankData)
      }

      // Structure à terme : récupérer les options pour chaque échéance Deribit
      if (spotPrice) {
        const instruments = await deribit.getInstruments(asset, 'option')
        const expiries = deribit.extractExpiries(instruments)
        const upcoming = expiries.filter(ts => ts > Date.now()).slice(0, 6)

        const structure = []
        await Promise.all(upcoming.map(async expiryTs => {
          try {
            const days = daysUntil(expiryTs)
            const expInstruments = instruments.filter(i => i.expiration_timestamp === expiryTs)

            // Trouver options proches de ATM
            const strikes = [...new Set(expInstruments.map(i => {
              const parts = i.instrument_name.split('-')
              return Number(parts[2])
            }))].sort((a, b) => Math.abs(a - spotPrice) - Math.abs(b - spotPrice))

            const atmStrike  = strikes[0]
            const strikeLow  = strikes.find(s => s < spotPrice)  // put side
            const strikeHigh = strikes.find(s => s > spotPrice)  // call side

            const [atmCall, atmPut] = await Promise.all([
              deribit.getTicker(`${asset}-${new Date(expiryTs).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'2-digit' }).replace(/ /g,'').toUpperCase()}-${atmStrike}-C`).catch(() => null),
              deribit.getTicker(`${asset}-${new Date(expiryTs).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'2-digit' }).replace(/ /g,'').toUpperCase()}-${atmStrike}-P`).catch(() => null),
            ])

            const atmIV = atmCall?.markIV ?? atmPut?.markIV ?? null

            // Chercher options 25-delta via les instruments listés
            const callInsts = expInstruments.filter(i => i.instrument_name.endsWith('-C'))
              .sort((a, b) => Number(a.instrument_name.split('-')[2]) - Number(b.instrument_name.split('-')[2]))
            const putInsts  = expInstruments.filter(i => i.instrument_name.endsWith('-P'))
              .sort((a, b) => Number(a.instrument_name.split('-')[2]) - Number(b.instrument_name.split('-')[2]))

            // Prendre le 25% quantile call (OTM) et put (OTM) comme proxy du 25-delta
            const call25Inst = callInsts[Math.floor(callInsts.length * 0.75)]
            const put25Inst  = putInsts[Math.floor(putInsts.length * 0.25)]
            const [call25, put25] = await Promise.all([
              call25Inst ? deribit.getTicker(call25Inst.instrument_name).catch(() => null) : null,
              put25Inst  ? deribit.getTicker(put25Inst.instrument_name).catch(() => null)  : null,
            ])

            const callIV25d = call25?.markIV ?? null
            const putIV25d  = put25?.markIV  ?? null
            const skew25d   = (callIV25d && putIV25d) ? putIV25d - callIV25d : null

            if (atmIV != null) {
              structure.push({ expiry: expiryTs, daysToExpiry: days, atmIV, callIV25d, putIV25d, skew25d })
            }
          } catch (_) {}
        }))

        structure.sort((a, b) => a.daysToExpiry - b.daysToExpiry)
        if (isMounted.current) setTermStructure(structure)

        // Greeks ATM nearest expiry
        const nearest = structure[0]
        if (nearest?.atmIV && spotPrice) {
          try {
            const ivFrac = nearest.atmIV / 100
            const g = calcOptionGreeks(spotPrice, spotPrice, nearest.daysToExpiry / 365, 0, ivFrac, 'call')
            if (isMounted.current) setGreeks({ ...g, expiry: nearest.daysToExpiry, iv: nearest.atmIV })
          } catch (_) {}
        }
      }

      if (isMounted.current) setLastUpdate(new Date())
    } catch (_) {}
    if (isMounted.current) setLoading(false)
  }

  const dvolChange = dvol?.current != null && dvol?.weekAgo != null
    ? dvol.current - dvol.weekAgo
    : null
  const ivPremium = dvol?.current != null && rv?.current != null
    ? dvol.current - rv.current
    : null

  // Binance options: grouper par échéance et trouver ATM
  const binGrouped = binOpts?.options ? groupByExpiry(binOpts.options) : []
  const spotPrice  = spot?.price ?? null
  const binAtmOpts = binGrouped.map(group => {
    const atmCall = findATMStrike(group.calls, spotPrice)
    const atmPut  = findATMStrike(group.puts,  spotPrice)
    return { ...group, atmCall, atmPut }
  }).filter(g => g.atmCall || g.atmPut)

  return (
    <div className="page-wrap">
      {/* Header */}
      <div className="page-header">
        <div className="page-title">Options <span>{asset}</span></div>
        <div className="status-row">
          {loading && <div className="dot-live" />}
          <button onClick={load} disabled={loading} style={{
            background: 'none', border: '1px solid var(--border)', borderRadius: 8,
            color: 'var(--text-muted)', fontSize: 11, padding: '4px 10px', cursor: 'pointer',
            fontFamily: 'var(--sans)', fontWeight: 600,
          }}>
            {loading ? '...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* DVOL cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 4 }}>
        <MetricCard
          label="DVOL Deribit"
          value={dvol?.current != null ? dvol.current.toFixed(1) : '—'}
          sub={dvolChange != null ? `7j: ${dvolChange > 0 ? '+' : ''}${dvolChange.toFixed(1)}` : `Range: ${dvol?.monthMin?.toFixed(1) ?? '—'}–${dvol?.monthMax?.toFixed(1) ?? '—'}`}
          color={dvol?.current > 80 ? 'var(--put)' : dvol?.current > 60 ? 'var(--atm)' : 'var(--call)'}
          bar={dvol ? (dvol.current - dvol.monthMin) / (dvol.monthMax - dvol.monthMin) * 100 : null}
        />
        <MetricCard
          label="IV Rank (30j)"
          value={ivAnalysis?.ivRank != null ? fmtPure(ivAnalysis.ivRank, 0) + '/100' : '—'}
          sub={`IV pct: ${fmtPure(ivAnalysis?.ivPercentile, 0)}`}
          color={ivAnalysis?.ivRank > 70 ? 'var(--put)' : ivAnalysis?.ivRank > 30 ? 'var(--atm)' : 'var(--call)'}
          bar={ivAnalysis?.ivRank}
        />
        <MetricCard
          label="Vol réalisée 30j"
          value={rv?.current != null ? fmtPct(rv.current, 1) : '—'}
          sub={`Moy: ${fmtPct(rv?.avg30, 1)}`}
          color="var(--text)"
        />
        <MetricCard
          label="Prime IV/RV"
          value={ivPremium != null ? (ivPremium > 0 ? '+' : '') + ivPremium.toFixed(1) + ' pts' : '—'}
          sub="DVOL − Vol Réalisée"
          color={ivPremium > 10 ? 'var(--put)' : ivPremium > 0 ? 'var(--atm)' : 'var(--call)'}
        />
      </div>

      {/* DVOL sparkline */}
      {dvol?.history?.length > 0 && (
        <>
          <SectionTitle>DVOL — 72 dernières heures</SectionTitle>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 16px', marginBottom: 4 }}>
            <DvolSparkline history={dvol.history} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
              <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>Min: {dvol.monthMin?.toFixed(1)}</span>
              <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>Max: {dvol.monthMax?.toFixed(1)}</span>
            </div>
          </div>
        </>
      )}

      {/* Structure à terme IV */}
      {termStructure.length > 0 && (
        <>
          <SectionTitle badge="Deribit">Structure à terme IV</SectionTitle>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', marginBottom: 4 }}>
            {/* Header */}
            <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr 1fr 1fr', gap: 4, padding: '8px 16px', background: 'rgba(255,255,255,.02)', borderBottom: '1px solid var(--border)' }}>
              {['Jours', 'ATM IV', 'Skew 25d', 'C25d/P25d'].map((h, i) => (
                <div key={h} style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--sans)', fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', textAlign: i === 0 ? 'left' : 'right' }}>{h}</div>
              ))}
            </div>
            {termStructure.map((row, i) => (
              <div key={row.expiry} style={{
                display: 'grid', gridTemplateColumns: '60px 1fr 1fr 1fr',
                gap: 4, padding: '10px 16px', alignItems: 'center',
                borderBottom: i < termStructure.length - 1 ? '1px solid rgba(255,255,255,.04)' : 'none',
              }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--sans)' }}>
                  {row.daysToExpiry.toFixed(0)}j
                </div>
                <div style={{ textAlign: 'right', fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 13, color: 'var(--atm)' }}>
                  {fmtPct(row.atmIV, 1)}
                </div>
                <div style={{ textAlign: 'right', fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 12, color: row.skew25d > 2 ? 'var(--put)' : row.skew25d < -2 ? 'var(--call)' : 'var(--text-muted)' }}>
                  {row.skew25d != null ? (row.skew25d > 0 ? '+' : '') + row.skew25d.toFixed(1) : '—'}
                </div>
                <div style={{ textAlign: 'right', fontSize: 10, color: 'var(--text-muted)' }}>
                  {row.callIV25d != null ? fmtPct(row.callIV25d, 1) : '—'}
                  {' / '}
                  {row.putIV25d  != null ? fmtPct(row.putIV25d,  1) : '—'}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Greeks ATM nearest */}
      {greeks && (
        <>
          <SectionTitle badge="Deribit">Greeks ATM — Échéance proche</SectionTitle>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', marginBottom: 4 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 10 }}>
              {[
                { label: 'Delta', value: fmtPure(greeks.delta, 3), color: 'var(--accent)' },
                { label: 'Gamma', value: greeks.gamma != null ? greeks.gamma.toExponential(2) : '—', color: 'var(--atm)' },
                { label: 'Vega',  value: greeks.vega != null ? fmtPure(greeks.vega, 2) : '—',  color: 'var(--call)' },
                { label: 'Theta', value: greeks.theta != null ? fmtPure(greeks.theta, 2) : '—', color: 'var(--put)' },
              ].map(g => (
                <div key={g.label} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 4 }}>{g.label}</div>
                  <div style={{ fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 15, color: g.color }}>{g.value}</div>
                </div>
              ))}
            </div>
            <div style={{ textAlign: 'center', fontSize: 10, color: 'var(--text-muted)' }}>
              ATM Call · IV {fmtPct(greeks.iv, 1)} · {greeks.expiry?.toFixed(0)}j à expiry
            </div>
          </div>
        </>
      )}

      {/* Binance Options */}
      {binAtmOpts.length > 0 && (
        <>
          <SectionTitle badge="Binance European">Options Binance — ATM par échéance</SectionTitle>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', marginBottom: 4 }}>
            {/* Header */}
            <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr 1fr 1fr', gap: 4, padding: '8px 16px', background: 'rgba(255,255,255,.02)', borderBottom: '1px solid var(--border)' }}>
              {['Jours', 'ATM IV Call', 'ATM IV Put', 'Skew'].map((h, i) => (
                <div key={h} style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--sans)', fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', textAlign: i === 0 ? 'left' : 'right' }}>{h}</div>
              ))}
            </div>
            {binAtmOpts.slice(0, 6).map((g, i) => {
              const callIV = g.atmCall?.markIV ?? null
              const putIV  = g.atmPut?.markIV  ?? null
              const skew   = (callIV && putIV) ? putIV - callIV : null
              return (
                <div key={g.expiry} style={{
                  display: 'grid', gridTemplateColumns: '60px 1fr 1fr 1fr',
                  gap: 4, padding: '10px 16px', alignItems: 'center',
                  borderBottom: i < binAtmOpts.slice(0, 6).length - 1 ? '1px solid rgba(255,255,255,.04)' : 'none',
                }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{g.daysToExpiry.toFixed(0)}j</div>
                  <div style={{ textAlign: 'right', fontSize: 13, fontWeight: 700, color: 'var(--call)' }}>
                    {callIV != null ? fmtPct(callIV, 1) : '—'}
                  </div>
                  <div style={{ textAlign: 'right', fontSize: 13, fontWeight: 700, color: 'var(--put)' }}>
                    {putIV != null ? fmtPct(putIV, 1) : '—'}
                  </div>
                  <div style={{ textAlign: 'right', fontSize: 12, fontWeight: 700, color: skew > 2 ? 'var(--put)' : skew < -2 ? 'var(--call)' : 'var(--text-muted)' }}>
                    {skew != null ? (skew > 0 ? '+' : '') + skew.toFixed(1) : '—'}
                  </div>
                </div>
              )
            })}
          </div>

          {/* OI Binance options par échéance */}
          {binOI?.byExpiry?.length > 0 && (
            <>
              <SectionTitle badge="Binance">OI Options par échéance</SectionTitle>
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 4, padding: '8px 16px', background: 'rgba(255,255,255,.02)', borderBottom: '1px solid var(--border)' }}>
                  {['Expiry', 'Call OI', 'Put OI', 'P/C ratio'].map((h, i) => (
                    <div key={h} style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--sans)', fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', textAlign: i === 0 ? 'left' : 'right' }}>{h}</div>
                  ))}
                </div>
                {binOI.byExpiry.slice(0, 6).map((row, i) => {
                  const ratio = row.callOI > 0 ? row.putOI / row.callOI : null
                  return (
                    <div key={i} style={{
                      display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr',
                      gap: 4, padding: '10px 16px', alignItems: 'center',
                      borderBottom: i < Math.min(binOI.byExpiry.length, 6) - 1 ? '1px solid rgba(255,255,255,.04)' : 'none',
                    }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--sans)' }}>
                        {row.expiry}
                      </div>
                      <div style={{ textAlign: 'right', fontSize: 12, fontWeight: 700, color: 'var(--call)' }}>
                        {fmtPure(row.callOI, 0)}
                      </div>
                      <div style={{ textAlign: 'right', fontSize: 12, fontWeight: 700, color: 'var(--put)' }}>
                        {fmtPure(row.putOI, 0)}
                      </div>
                      <div style={{ textAlign: 'right', fontSize: 12, fontWeight: 700, color: ratio > 1 ? 'var(--put)' : 'var(--call)' }}>
                        {ratio != null ? fmtPure(ratio, 2) : '—'}
                      </div>
                    </div>
                  )
                })}
                {/* Total OI */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 4, padding: '8px 16px', borderTop: '1px solid var(--border)', background: 'rgba(255,255,255,.02)' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700 }}>TOTAL</div>
                  <div style={{ textAlign: 'right', fontSize: 11, fontWeight: 800, color: 'var(--call)' }}>{fmtPure(binOI.callOI, 0)}</div>
                  <div style={{ textAlign: 'right', fontSize: 11, fontWeight: 800, color: 'var(--put)' }}>{fmtPure(binOI.putOI, 0)}</div>
                  <div style={{ textAlign: 'right', fontSize: 11, fontWeight: 800, color: binOI.putCallRatio > 1 ? 'var(--put)' : 'var(--call)' }}>
                    {binOI.putCallRatio != null ? fmtPure(binOI.putCallRatio, 3) : '—'}
                  </div>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {termStructure.length === 0 && !loading && (
        <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)', fontSize: 13 }}>
          Appuie sur Refresh pour charger les données
        </div>
      )}

      {lastUpdate && (
        <div style={{ textAlign: 'center', fontSize: 10, color: 'var(--text-muted)', opacity: .5, marginTop: 12, marginBottom: 4 }}>
          Mis à jour {lastUpdate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </div>
      )}
    </div>
  )
}
