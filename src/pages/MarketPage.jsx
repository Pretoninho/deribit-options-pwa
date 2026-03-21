/**
 * MarketPage — Vue marché multi-exchange
 *
 * Affiche les prix spot de toutes les plateformes côte à côte,
 * puis les futures Deribit avec basis.
 */
import { useState, useEffect, useRef } from 'react'
import { dataCore } from '../data_core/index.js'
import * as deribit from '../data_core/providers/deribit.js'
import * as binance from '../data_core/providers/binance.js'
import * as coinbase from '../data_core/providers/coinbase.js'
import { dataStore, CacheKey } from '../data_core/data_store/cache.js'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtPrice(n, asset) {
  if (!Number.isFinite(n)) return '—'
  return '$' + n.toLocaleString('en-US', { maximumFractionDigits: asset === 'ETH' ? 2 : 0 })
}

function fmtVol(n) {
  if (!Number.isFinite(n) || n === 0) return '—'
  if (n >= 1e9) return '$' + (n / 1e9).toFixed(1) + 'B'
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(0) + 'M'
  return '$' + n.toLocaleString('en-US', { maximumFractionDigits: 0 })
}

function fmtExpiry(ts) {
  return new Date(ts).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'short', year: '2-digit',
  }).toUpperCase()
}

function daysUntil(ts) {
  return Math.max(1, Math.round((ts - Date.now()) / 86400000))
}

function pctColor(v) {
  if (!Number.isFinite(v)) return 'var(--text-muted)'
  if (v > 0) return 'var(--call)'
  if (v < 0) return 'var(--put)'
  return 'var(--text-muted)'
}

// ── Sous-composants ───────────────────────────────────────────────────────────

function SectionTitle({ children }) {
  return (
    <div style={{
      fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--sans)',
      fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase',
      marginBottom: 8, marginTop: 20,
    }}>
      {children}
    </div>
  )
}

function ExchangeRow({ name, color, price, asset, bid, ask, volume24h, change24h }) {
  const spread = (bid && ask) ? ((ask - bid) / ask * 100) : null
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '80px 1fr 1fr 1fr',
      alignItems: 'center', gap: 6, padding: '10px 16px',
      borderBottom: '1px solid rgba(255,255,255,.04)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
        <span style={{ fontSize: 11, fontFamily: 'var(--sans)', fontWeight: 700, color: 'var(--text)' }}>
          {name}
        </span>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 14, color: 'var(--text)' }}>
          {fmtPrice(price, asset)}
        </div>
        {Number.isFinite(change24h) && (
          <div style={{ fontSize: 9, color: pctColor(change24h), fontWeight: 700 }}>
            {change24h > 0 ? '+' : ''}{change24h.toFixed(2)}%
          </div>
        )}
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          {fmtVol(volume24h)}
        </div>
        {spread != null && (
          <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>
            spread {spread.toFixed(3)}%
          </div>
        )}
      </div>
      <div style={{ textAlign: 'right' }}>
        {bid && ask ? (
          <div style={{ fontSize: 9, color: 'var(--text-muted)', lineHeight: 1.6 }}>
            <span style={{ color: 'var(--call)' }}>{fmtPrice(bid, asset)}</span>
            {' / '}
            <span style={{ color: 'var(--put)' }}>{fmtPrice(ask, asset)}</span>
          </div>
        ) : (
          <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>—</div>
        )}
      </div>
    </div>
  )
}

// ── Page principale ───────────────────────────────────────────────────────────

export default function MarketPage({ asset }) {
  const [spots, setSpots]       = useState({})
  const [futures, setFutures]   = useState([])
  const [loading, setLoading]   = useState(false)
  const [lastUpdate, setLastUpdate] = useState(null)
  const isMounted = useRef(true)

  useEffect(() => {
    isMounted.current = true
    load()
    // Rafraîchissement auto toutes les 10s
    const timer = setInterval(() => { if (isMounted.current) load() }, 10_000)
    return () => { isMounted.current = false; clearInterval(timer) }
  }, [asset])

  const load = async () => {
    setLoading(true)
    try {
      // Spots multi-exchange en parallèle
      const [dSpot, bSpot, cSpot] = await Promise.allSettled([
        deribit.getSpot(asset),
        binance.getSpot(asset),
        coinbase.getSpot(asset),
      ])

      // Binance: récupère change 24h via ticker
      const bTicker24h = await binance.getSpot(asset).catch(() => null)

      if (isMounted.current) {
        setSpots({
          deribit:  dSpot.status  === 'fulfilled' ? dSpot.value  : null,
          binance:  bSpot.status  === 'fulfilled' ? bSpot.value  : null,
          coinbase: cSpot.status  === 'fulfilled' ? cSpot.value  : null,
        })
      }

      // Futures Deribit
      const instruments = await deribit.getInstruments(asset, 'future')
      const futureRows = []
      const spotPrice = dSpot.status === 'fulfilled' ? dSpot.value?.price : null

      await Promise.all(instruments.slice(0, 10).map(async f => {
        try {
          const ticker = await deribit.getTicker(f.instrument_name)
          if (!ticker?.price) return
          const isPerp = f.instrument_name.includes('PERPETUAL')
          const days = isPerp ? null : daysUntil(f.expiration_timestamp)
          const basis = spotPrice ? (ticker.price - spotPrice) / spotPrice * 100 : null
          const basisAnn = (!isPerp && basis != null && days) ? basis / days * 365 : null
          futureRows.push({
            name:     f.instrument_name,
            expiry:   isPerp ? 'PERP' : fmtExpiry(f.expiration_timestamp),
            expiryTs: isPerp ? 0 : f.expiration_timestamp,
            price:    ticker.price,
            days, basis, basisAnn, isPerp,
          })
        } catch (_) {}
      }))

      futureRows.sort((a, b) => {
        if (a.isPerp) return -1
        if (b.isPerp) return 1
        return a.days - b.days
      })

      if (isMounted.current) {
        setFutures(futureRows)
        setLastUpdate(new Date())
      }
    } catch (_) {}
    if (isMounted.current) setLoading(false)
  }

  // VWAP multi-exchange
  const spotPrices  = Object.values(spots).filter(s => s?.price != null)
  const vwap        = spotPrices.length > 0
    ? spotPrices.reduce((s, t) => s + t.price, 0) / spotPrices.length
    : null
  const deribitSpot = spots.deribit?.price
  const binanceSpot = spots.binance?.price
  const coinbaseSpot = spots.coinbase?.price

  const binanceVol  = spots.binance?.volume24h
  const coinbaseVol = spots.coinbase?.volume24h
  const binanceRaw  = spots.binance?.raw
  const change24h   = binanceRaw?.priceChangePercent != null ? Number(binanceRaw.priceChangePercent) : null

  const bestBasisAnn = futures
    .filter(r => !r.isPerp && r.basisAnn != null)
    .reduce((best, r) => (best == null || r.basisAnn > best ? r.basisAnn : best), null)
  const nearest = futures.find(r => !r.isPerp)
  const perp    = futures.find(r => r.isPerp)

  return (
    <div className="page-wrap">
      {/* Header */}
      <div className="page-header">
        <div className="page-title">Market <span>{asset}</span></div>
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

      {/* Cards résumé */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 4 }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px' }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--sans)', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 6 }}>VWAP {asset}</div>
          <div style={{ fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 20, color: 'var(--accent)' }}>{fmtPrice(vwap, asset)}</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>{spotPrices.length} exchange{spotPrices.length > 1 ? 's' : ''}</div>
        </div>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px' }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--sans)', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 6 }}>24h Change</div>
          <div style={{ fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 20, color: pctColor(change24h) }}>
            {change24h != null ? (change24h > 0 ? '+' : '') + change24h.toFixed(2) + '%' : '—'}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>Binance 24h</div>
        </div>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px' }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--sans)', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 6 }}>Future proche</div>
          <div style={{ fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 20, color: 'var(--atm)' }}>
            {nearest ? fmtPrice(nearest.price, asset) : '—'}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>
            {nearest ? `${nearest.expiry} · ${nearest.days}j` : 'Deribit'}
          </div>
        </div>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px' }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--sans)', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 6 }}>Basis max /an</div>
          <div style={{ fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 20, color: bestBasisAnn > 3 ? 'var(--call)' : bestBasisAnn > 0 ? 'var(--atm)' : 'var(--text-muted)' }}>
            {bestBasisAnn != null ? (bestBasisAnn > 0 ? '+' : '') + bestBasisAnn.toFixed(2) + '%' : '—'}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>Meilleure échéance</div>
        </div>
      </div>

      {/* Spot multi-exchange */}
      <SectionTitle>Spot — Comparaison exchanges</SectionTitle>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', marginBottom: 4 }}>
        {/* Header colonnes */}
        <div style={{
          display: 'grid', gridTemplateColumns: '80px 1fr 1fr 1fr',
          gap: 6, padding: '8px 16px',
          background: 'rgba(255,255,255,.02)', borderBottom: '1px solid var(--border)',
        }}>
          {['Exchange', 'Prix', 'Volume 24h', 'Bid / Ask'].map((h, i) => (
            <div key={h} style={{
              fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--sans)',
              fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase',
              textAlign: i === 0 ? 'left' : 'right',
            }}>{h}</div>
          ))}
        </div>
        <ExchangeRow
          name="Deribit" color="var(--accent)"
          price={deribitSpot} asset={asset}
          bid={null} ask={null} volume24h={null}
        />
        <ExchangeRow
          name="Binance" color="#F0B90B"
          price={binanceSpot} asset={asset}
          bid={spots.binance?.bid} ask={spots.binance?.ask}
          volume24h={binanceVol}
          change24h={change24h}
        />
        <ExchangeRow
          name="Coinbase" color="#0052FF"
          price={coinbaseSpot} asset={asset}
          bid={spots.coinbase?.bid} ask={spots.coinbase?.ask}
          volume24h={coinbaseVol}
        />
        {/* Spread Deribit↔Binance */}
        {deribitSpot && binanceSpot && (
          <div style={{ padding: '8px 16px', borderTop: '1px solid rgba(255,255,255,.04)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Deribit vs Binance</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: pctColor(deribitSpot - binanceSpot) }}>
              {deribitSpot > binanceSpot ? '+' : ''}{((deribitSpot - binanceSpot) / binanceSpot * 100).toFixed(3)}%
            </span>
          </div>
        )}
      </div>

      {/* Futures Deribit */}
      <SectionTitle>Futures Deribit — Structure à terme</SectionTitle>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        {/* Colonnes header */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr',
          gap: 4, padding: '8px 16px',
          background: 'rgba(255,255,255,.02)', borderBottom: '1px solid var(--border)',
        }}>
          {['Échéance', 'Prix', 'Basis', 'Basis/an'].map((h, i) => (
            <div key={h} style={{
              fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--sans)',
              fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase',
              textAlign: i === 0 ? 'left' : 'right',
            }}>{h}</div>
          ))}
        </div>

        {futures.length === 0 && !loading && (
          <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
            Appuie sur Refresh
          </div>
        )}

        {futures.map((r, i) => (
          <div key={r.name} style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr',
            gap: 4, padding: '11px 16px', alignItems: 'center',
            borderBottom: i < futures.length - 1 ? '1px solid rgba(255,255,255,.04)' : 'none',
            background: r.isPerp ? 'rgba(0,212,255,.03)' : 'transparent',
          }}>
            <div>
              <div style={{ fontFamily: 'var(--mono, monospace)', fontSize: 11, color: r.isPerp ? 'var(--accent)' : 'var(--text)', fontWeight: 600 }}>
                {r.expiry}
              </div>
              {r.days && <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{r.days}j</div>}
            </div>
            <div style={{ fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 13, color: 'var(--text)', textAlign: 'right' }}>
              {fmtPrice(r.price, asset)}
            </div>
            <div style={{ textAlign: 'right' }}>
              {r.basis != null
                ? <span style={{ fontSize: 12, fontWeight: 700, color: pctColor(r.basis) }}>{r.basis > 0 ? '+' : ''}{r.basis.toFixed(2)}%</span>
                : <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>—</span>}
            </div>
            <div style={{ textAlign: 'right' }}>
              {r.basisAnn != null
                ? <span style={{ fontSize: 12, fontWeight: 700, color: r.basisAnn > 5 ? 'var(--call)' : r.basisAnn > 0 ? 'var(--atm)' : 'var(--put)' }}>{r.basisAnn > 0 ? '+' : ''}{r.basisAnn.toFixed(1)}%/an</span>
                : <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>—</span>}
            </div>
          </div>
        ))}
      </div>

      {lastUpdate && (
        <div style={{ textAlign: 'center', fontSize: 10, color: 'var(--text-muted)', opacity: .5, marginTop: 12, marginBottom: 4 }}>
          Mis à jour {lastUpdate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </div>
      )}
    </div>
  )
}
