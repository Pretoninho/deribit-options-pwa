import { useState, useEffect } from 'react'
import { getDVOL, getFundingRate, getRealizedVol, getFutures, getFuturePrice, getSpot } from '../utils/api.js'
import { computeSignal, getSignal } from '../data_processing/signals/signal_engine.js'

function ScoreBar({ label, score, color, maxScore = 100 }) {
  if (score == null) return null
  const pct = Math.min(100, Math.max(0, (score / maxScore) * 100))
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{label}</span>
        <span style={{ fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 13, color: color || 'var(--text)' }}>
          {score}/100
        </span>
      </div>
      <div style={{ height: 6, background: 'rgba(255,255,255,.06)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${pct}%`, borderRadius: 3,
          background: color || 'var(--accent)', transition: 'width .5s',
        }} />
      </div>
    </div>
  )
}

export default function SignalsPage({ asset }) {
  const [result, setResult] = useState(null)
  const [rawData, setRawData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [lastUpdate, setLastUpdate] = useState(null)
  const [history, setHistory] = useState([])

  useEffect(() => {
    load()
  }, [asset])

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const [dvol, funding, rv, spot, futures] = await Promise.all([
        getDVOL(asset).catch(() => null),
        getFundingRate(asset).catch(() => null),
        getRealizedVol(asset).catch(() => null),
        getSpot(asset).catch(() => null),
        getFutures(asset).catch(() => []),
      ])

      // Compute average basis annualized
      let basisAvg = null
      if (spot && futures.length) {
        const prices = await Promise.all(
          futures
            .filter(f => !f.instrument_name.includes('PERPETUAL'))
            .map(async f => {
              const price = await getFuturePrice(f.instrument_name).catch(() => null)
              if (!price) return null
              const days = Math.max(1, Math.round((f.expiration_timestamp - Date.now()) / 86400000))
              const basis = (price - spot) / spot * 100
              return basis / days * 365
            })
        )
        const valid = prices.filter(p => p != null)
        if (valid.length) basisAvg = valid.reduce((s, v) => s + v, 0) / valid.length
      }

      const raw = { dvol, funding, rv, basisAvg }
      setRawData(raw)

      const sig = computeSignal({ dvol, funding, rv, basisAvg })
      setResult(sig)

      // Keep score history (max 20 entries)
      if (sig?.global != null) {
        setHistory(prev => {
          const entry = { score: sig.global, ts: Date.now() }
          return [...prev.slice(-19), entry]
        })
      }

      setLastUpdate(new Date())
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }

  const signal = result?.signal
  const scores = result?.scores
  const globalScore = result?.global

  const scoreColor = globalScore >= 70 ? 'var(--call)' : globalScore >= 50 ? 'var(--atm)' : globalScore >= 30 ? 'var(--accent2)' : 'var(--put)'

  return (
    <div className="page-wrap">
      {/* Header */}
      <div className="page-header">
        <div className="page-title">Signaux <span>{asset}</span></div>
        <div className="status-row">
          {loading && <div className="dot-live" />}
          <button
            onClick={load}
            disabled={loading}
            style={{
              background: 'none', border: '1px solid var(--border)', borderRadius: 8,
              color: 'var(--text-muted)', fontSize: 11, padding: '4px 10px', cursor: 'pointer',
              fontFamily: 'var(--sans)', fontWeight: 600,
            }}
          >
            {loading ? '...' : 'Refresh'}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ background: 'rgba(255,77,109,.1)', border: '1px solid rgba(255,77,109,.3)', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: 'var(--put)' }}>
          {error}
        </div>
      )}

      {/* Big score card */}
      <div style={{
        background: signal ? `rgba(${signal.bg ? '0,229,160' : '255,255,255'},.04)` : 'var(--surface)',
        border: `1px solid ${signal?.border || 'var(--border)'}`,
        borderRadius: 16, padding: '24px', marginBottom: 16, textAlign: 'center',
      }}>
        {globalScore != null ? (
          <>
            {/* Circular-ish score display */}
            <div style={{ position: 'relative', display: 'inline-block', marginBottom: 16 }}>
              <svg width="120" height="120" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(255,255,255,.06)" strokeWidth="8"/>
                <circle
                  cx="60" cy="60" r="50" fill="none"
                  stroke={scoreColor} strokeWidth="8"
                  strokeDasharray={`${2 * Math.PI * 50 * globalScore / 100} ${2 * Math.PI * 50}`}
                  strokeLinecap="round"
                  transform="rotate(-90 60 60)"
                  style={{ transition: 'stroke-dasharray .5s' }}
                />
              </svg>
              <div style={{
                position: 'absolute', top: '50%', left: '50%',
                transform: 'translate(-50%, -50%)',
                fontFamily: 'var(--sans)', fontWeight: 900, fontSize: 28,
                color: scoreColor, lineHeight: 1,
              }}>
                {globalScore}
              </div>
            </div>

            <div style={{ fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 18, color: 'var(--text)', marginBottom: 6 }}>
              {signal?.label || '—'}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, maxWidth: 260, margin: '0 auto' }}>
              {signal?.action || '—'}
            </div>
          </>
        ) : (
          <div style={{ padding: '20px 0', color: 'var(--text-muted)', fontSize: 13 }}>
            {loading ? 'Calcul du signal...' : 'Appuie sur Refresh pour charger'}
          </div>
        )}
      </div>

      {/* Score history mini chart */}
      {history.length > 1 && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--sans)', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 10 }}>
            Historique du score (session)
          </div>
          <svg viewBox={`0 0 300 40`} preserveAspectRatio="none" style={{ width: '100%', height: 40 }}>
            <polyline
              points={history.map((h, i) => `${(i / (history.length - 1)) * 300},${40 - (h.score / 100) * 40}`).join(' ')}
              fill="none" stroke="var(--accent)" strokeWidth="2"
            />
          </svg>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Premier</span>
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Maintenant</span>
          </div>
        </div>
      )}

      {/* Score breakdown */}
      {scores && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--sans)', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 14 }}>
            Décomposition du score
          </div>
          <ScoreBar
            label="Volatilité implicite (IV) — 35%"
            score={scores.iv}
            color={scores.iv >= 70 ? 'var(--call)' : scores.iv >= 40 ? 'var(--atm)' : 'var(--put)'}
          />
          <ScoreBar
            label="Funding Rate — 25%"
            score={scores.funding}
            color={scores.funding >= 70 ? 'var(--call)' : scores.funding >= 40 ? 'var(--atm)' : 'var(--put)'}
          />
          <ScoreBar
            label="Basis Futures — 25%"
            score={scores.basis}
            color={scores.basis >= 70 ? 'var(--call)' : scores.basis >= 40 ? 'var(--atm)' : 'var(--put)'}
          />
          <ScoreBar
            label="Prime IV vs RV — 15%"
            score={scores.ivRv}
            color={scores.ivRv >= 70 ? 'var(--call)' : scores.ivRv >= 40 ? 'var(--atm)' : 'var(--put)'}
          />
        </div>
      )}

      {/* Raw data summary */}
      {rawData && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', marginBottom: 16 }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--sans)', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase' }}>
              Données sources
            </div>
          </div>
          <div style={{ padding: '14px 16px' }}>
            {[
              { label: 'DVOL actuel', value: rawData.dvol?.current?.toFixed(1) + '%', sub: `Moy 30j: ${rawData.dvol ? ((rawData.dvol.monthMin + rawData.dvol.monthMax) / 2).toFixed(1) : '—'}%` },
              { label: 'Funding /an', value: rawData.funding?.current?.toFixed(2) + '%', sub: `Moy 7j: ${rawData.funding?.avgAnn7d?.toFixed(2) ?? '—'}%` },
              { label: 'Basis moy /an', value: rawData.basisAvg != null ? (rawData.basisAvg > 0 ? '+' : '') + rawData.basisAvg.toFixed(2) + '%' : '—', sub: 'Moyenne futures datés' },
              { label: 'RV actuelle', value: rawData.rv?.current?.toFixed(1) + '%', sub: `Moy 30j: ${rawData.rv?.avg30?.toFixed(1) ?? '—'}%` },
            ].map((r, i, arr) => (
              <div key={r.label} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                paddingBottom: i < arr.length - 1 ? 10 : 0,
                marginBottom: i < arr.length - 1 ? 10 : 0,
                borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,.04)' : 'none',
              }}>
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{r.label}</span>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{r.value ?? '—'}</div>
                  {r.sub && <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{r.sub}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {lastUpdate && (
        <div style={{ textAlign: 'center', fontSize: 10, color: 'var(--text-muted)', opacity: .5, marginTop: 4 }}>
          Mis à jour {lastUpdate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </div>
      )}
    </div>
  )
}
