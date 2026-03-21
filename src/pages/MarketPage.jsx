import { useState, useEffect } from 'react'
import { getSpot, getFutures, getFuturePrice, getFundingRate } from '../utils/api.js'

function daysUntil(ts) {
  return Math.max(1, Math.round((ts - Date.now()) / 86400000))
}

function fmtExpiry(ts) {
  return new Date(ts).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'short', year: '2-digit',
  }).toUpperCase()
}

function fmtPrice(n, asset) {
  if (!Number.isFinite(n)) return '—'
  return '$' + n.toLocaleString('en-US', {
    maximumFractionDigits: asset === 'ETH' ? 2 : 0,
  })
}

function MetricCard({ label, value, sub, color }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 12, padding: '14px 16px',
    }}>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--sans)', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 20, color: color || 'var(--text)' }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>{sub}</div>}
    </div>
  )
}

export default function MarketPage({ asset }) {
  const [spot, setSpot] = useState(null)
  const [rows, setRows] = useState([])
  const [funding, setFunding] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [lastUpdate, setLastUpdate] = useState(null)

  useEffect(() => {
    load()
  }, [asset])

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const [sp, futures, fundingData] = await Promise.all([
        getSpot(asset),
        getFutures(asset),
        getFundingRate(asset).catch(() => null),
      ])
      setSpot(sp)
      setFunding(fundingData)

      const built = []
      await Promise.all(futures.map(async f => {
        try {
          const price = await getFuturePrice(f.instrument_name)
          if (!price) return
          const isPerp = f.instrument_name.includes('PERPETUAL')
          const days = isPerp ? null : daysUntil(f.expiration_timestamp)
          const basis = sp ? (price - sp) / sp * 100 : null
          const basisAnn = (!isPerp && basis != null && days) ? basis / days * 365 : null
          built.push({
            name: f.instrument_name,
            expiry: isPerp ? 'PERP' : fmtExpiry(f.expiration_timestamp),
            price, days, basis, basisAnn, isPerp,
          })
        } catch (_) {}
      }))

      built.sort((a, b) => (a.days || 9999) - (b.days || 9999))
      setRows(built)
      setLastUpdate(new Date())
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }

  // Derived metrics for cards
  const nearest = rows.find(r => !r.isPerp)
  const perp = rows.find(r => r.isPerp)
  const bestBasisAnn = rows
    .filter(r => !r.isPerp && r.basisAnn != null)
    .reduce((best, r) => (best == null || r.basisAnn > best ? r.basisAnn : best), null)

  return (
    <div className="page-wrap">
      {/* Header */}
      <div className="page-header">
        <div className="page-title">Market <span>{asset}</span></div>
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

      {/* Metric cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20 }}>
        <MetricCard
          label={`Spot ${asset}`}
          value={spot ? fmtPrice(spot, asset) : '—'}
          color="var(--accent)"
        />
        <MetricCard
          label="Future proche"
          value={nearest ? fmtPrice(nearest.price, asset) : '—'}
          sub={nearest ? `${nearest.expiry} · ${nearest.days}j` : null}
          color="var(--atm)"
        />
        <MetricCard
          label="Funding Perp"
          value={funding?.current != null ? (funding.current > 0 ? '+' : '') + funding.current.toFixed(2) + '%' : '—'}
          sub={funding ? '/an' : null}
          color={funding?.current > 0 ? 'var(--call)' : funding?.current < 0 ? 'var(--put)' : 'var(--text-muted)'}
        />
        <MetricCard
          label="Basis max ann."
          value={bestBasisAnn != null ? (bestBasisAnn > 0 ? '+' : '') + bestBasisAnn.toFixed(2) + '%' : '—'}
          sub="Meilleure échéance"
          color={bestBasisAnn > 3 ? 'var(--call)' : bestBasisAnn > 0 ? 'var(--atm)' : 'var(--put)'}
        />
      </div>

      {/* Funding detail */}
      {funding && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 16px', marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--sans)', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 10 }}>
            Funding Rate — {asset}-PERPETUAL
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Actuel</div>
              <div style={{ fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 15, color: funding.current > 0 ? 'var(--call)' : 'var(--put)' }}>
                {(funding.current > 0 ? '+' : '') + funding.current.toFixed(2)}%/an
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Moy 7j</div>
              <div style={{ fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 15, color: funding.avgAnn7d > 0 ? 'var(--call)' : 'var(--put)' }}>
                {(funding.avgAnn7d > 0 ? '+' : '') + (funding.avgAnn7d ?? 0).toFixed(2)}%/an
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Sentiment</div>
              <div style={{ fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 13, color: funding.bullish ? 'var(--call)' : 'var(--put)' }}>
                {funding.bullish ? 'Haussier' : 'Baissier'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Futures table */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--sans)', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase' }}>
            Contrats Futures
          </div>
        </div>

        {rows.length === 0 && !loading && (
          <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            Appuie sur Refresh pour charger les données
          </div>
        )}

        {rows.map((r, i) => (
          <div key={r.name} style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr',
            gap: 4, padding: '12px 16px', alignItems: 'center',
            borderBottom: i < rows.length - 1 ? '1px solid rgba(255,255,255,.04)' : 'none',
            background: r.isPerp ? 'rgba(0,212,255,.03)' : 'transparent',
          }}>
            <div>
              <div style={{ fontFamily: 'var(--mono, monospace)', fontSize: 11, color: r.isPerp ? 'var(--accent)' : 'var(--text)', fontWeight: 600 }}>
                {r.expiry}
              </div>
              {r.days && (
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{r.days}j</div>
              )}
            </div>
            <div style={{ fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 13, color: 'var(--text)', textAlign: 'right' }}>
              {fmtPrice(r.price, asset)}
            </div>
            <div style={{ textAlign: 'right' }}>
              {r.basis != null ? (
                <span style={{ fontSize: 12, fontWeight: 700, color: r.basis > 0 ? 'var(--call)' : 'var(--put)' }}>
                  {r.basis > 0 ? '+' : ''}{r.basis.toFixed(2)}%
                </span>
              ) : <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>—</span>}
            </div>
            <div style={{ textAlign: 'right' }}>
              {r.basisAnn != null ? (
                <span style={{ fontSize: 12, fontWeight: 700, color: r.basisAnn > 5 ? 'var(--call)' : r.basisAnn > 0 ? 'var(--atm)' : 'var(--put)' }}>
                  {r.basisAnn > 0 ? '+' : ''}{r.basisAnn.toFixed(1)}%/an
                </span>
              ) : <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>—</span>}
            </div>
          </div>
        ))}

        {/* Table header (at bottom as legend) */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr',
          gap: 4, padding: '8px 16px',
          borderTop: '1px solid var(--border)',
          background: 'rgba(255,255,255,.02)',
        }}>
          {['Échéance', 'Prix', 'Basis', 'Basis/an'].map(h => (
            <div key={h} style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--sans)', fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', textAlign: h === 'Échéance' ? 'left' : 'right' }}>
              {h}
            </div>
          ))}
        </div>
      </div>

      {lastUpdate && (
        <div style={{ textAlign: 'center', fontSize: 10, color: 'var(--text-muted)', opacity: .5, marginTop: 12 }}>
          Mis à jour {lastUpdate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </div>
      )}
    </div>
  )
}
