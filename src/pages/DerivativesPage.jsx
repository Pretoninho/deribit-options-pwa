/**
 * DerivativesPage — Vue dérivés cross-exchange
 *
 * Perpétuels funding, sentiment, liquidations, OI.
 * Sources : Deribit + Binance
 */
import { useState, useEffect, useRef } from 'react'
import * as deribit from '../data_core/providers/deribit.js'
import * as binance from '../data_core/providers/binance.js'
import { dataStore, CacheKey } from '../data_core/data_store/cache.js'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n, decimals = 2, suffix = '') {
  if (!Number.isFinite(n)) return '—'
  return (n > 0 ? '+' : '') + n.toFixed(decimals) + suffix
}

function fmtPure(n, decimals = 2, suffix = '') {
  if (!Number.isFinite(n)) return '—'
  return n.toFixed(decimals) + suffix
}

function fmtUSD(n) {
  if (!Number.isFinite(n) || n === 0) return '—'
  if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B'
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M'
  if (n >= 1e3) return '$' + (n / 1e3).toFixed(0) + 'K'
  return '$' + n.toFixed(0)
}

function pctColor(v) {
  if (!Number.isFinite(v)) return 'var(--text-muted)'
  if (v > 0) return 'var(--call)'
  if (v < 0) return 'var(--put)'
  return 'var(--text-muted)'
}

// ── Composants partagés ───────────────────────────────────────────────────────

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

function Card({ label, value, sub, color, badge }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 12, padding: '14px 16px',
    }}>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--sans)', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <div style={{ fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 20, color: color || 'var(--text)' }}>
          {value}
        </div>
        {badge && (
          <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: badge === 'BULL' ? 'rgba(0,255,127,.12)' : badge === 'BEAR' ? 'rgba(255,77,109,.12)' : 'rgba(255,255,255,.08)', color: badge === 'BULL' ? 'var(--call)' : badge === 'BEAR' ? 'var(--put)' : 'var(--text-muted)' }}>
            {badge}
          </span>
        )}
      </div>
      {sub && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>{sub}</div>}
    </div>
  )
}

/** Ligne dans un tableau de comparaison funding */
function FundingRow({ exchange, color, rate8h, rateAnn, markPrice, nextFundingTime }) {
  const timeLeft = nextFundingTime ? Math.max(0, nextFundingTime - Date.now()) : null
  const hLeft = timeLeft ? Math.floor(timeLeft / 3600000) : null
  const mLeft = timeLeft ? Math.floor((timeLeft % 3600000) / 60000) : null
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '90px 1fr 1fr 1fr',
      alignItems: 'center', gap: 4, padding: '10px 16px',
      borderBottom: '1px solid rgba(255,255,255,.04)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
        <span style={{ fontSize: 11, fontFamily: 'var(--sans)', fontWeight: 700, color: 'var(--text)' }}>
          {exchange}
        </span>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: pctColor(rate8h), fontFamily: 'var(--sans)' }}>
          {fmt(rate8h, 4, '%')}
        </div>
        <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>/ 8h</div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: pctColor(rateAnn), fontFamily: 'var(--sans)' }}>
          {fmt(rateAnn, 2, '%')}
        </div>
        <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>/ an</div>
      </div>
      <div style={{ textAlign: 'right' }}>
        {hLeft != null
          ? <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{hLeft}h {mLeft}m</div>
          : markPrice ? <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>${Number(markPrice).toLocaleString('en-US', { maximumFractionDigits: 0 })}</div>
          : <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>—</div>}
      </div>
    </div>
  )
}

// ── Page principale ───────────────────────────────────────────────────────────

export default function DerivativesPage({ asset }) {
  const [dFunding,     setDFunding]     = useState(null)
  const [bFunding,     setBFunding]     = useState(null)
  const [dFundingHist, setDFundingHist] = useState(null)
  const [sentiment,    setSentiment]    = useState(null)
  const [takerVol,     setTakerVol]     = useState(null)
  const [dOI,          setDOI]          = useState(null)
  const [bOI,          setBOI]          = useState(null)
  const [liquidations, setLiquidations] = useState(null)
  const [deliveries,   setDeliveries]   = useState(null)
  const [loading,      setLoading]      = useState(false)
  const [lastUpdate,   setLastUpdate]   = useState(null)
  const isMounted = useRef(true)

  useEffect(() => {
    isMounted.current = true
    load()
    const timer = setInterval(() => { if (isMounted.current) load() }, 30_000)
    return () => { isMounted.current = false; clearInterval(timer) }
  }, [asset])

  const load = async () => {
    setLoading(true)
    const results = await Promise.allSettled([
      deribit.getFundingRate(asset),
      binance.getPremiumIndex(asset),
      deribit.getFundingRateHistory(asset, 30),
      binance.getLongShortRatio(asset),
      binance.getTakerVolume(asset),
      deribit.getOpenInterest(asset),
      binance.getOpenInterest(asset),
      binance.getLiquidations(asset),
      deribit.getDeliveryPrices(asset),
    ])
    if (!isMounted.current) return

    const [df, bf, dfh, sent, tv, doi, boi, liq, del] = results
    setDFunding(     df.status  === 'fulfilled' ? df.value   : null)
    setBFunding(     bf.status  === 'fulfilled' ? bf.value   : null)
    setDFundingHist( dfh.status === 'fulfilled' ? dfh.value  : null)
    setSentiment(    sent.status=== 'fulfilled' ? sent.value : null)
    setTakerVol(     tv.status  === 'fulfilled' ? tv.value   : null)
    setDOI(          doi.status === 'fulfilled' ? doi.value  : null)
    setBOI(          boi.status === 'fulfilled' ? boi.value  : null)
    setLiquidations( liq.status === 'fulfilled' ? liq.value  : null)
    setDeliveries(   del.status === 'fulfilled' ? del.value  : null)
    setLastUpdate(new Date())
    setLoading(false)
  }

  // Métriques calculées
  const fundingDiff = (dFunding?.rateAnn != null && bFunding?.rateAnn != null)
    ? dFunding.rateAnn - bFunding.rateAnn
    : null
  const avgDFunding30 = dFundingHist?.history?.length
    ? dFundingHist.history.reduce((s, r) => s + r.rateAnn, 0) / dFundingHist.history.length
    : null

  return (
    <div className="page-wrap">
      {/* Header */}
      <div className="page-header">
        <div className="page-title">Derivés <span>{asset}</span></div>
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

      {/* Résumé cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 4 }}>
        <Card
          label="Funding Deribit /an"
          value={dFunding?.rateAnn != null ? fmt(dFunding.rateAnn, 2, '%') : '—'}
          sub={`8h: ${dFunding?.rate8h != null ? fmt(dFunding.rate8h, 4, '%') : '—'}`}
          color={pctColor(dFunding?.rateAnn)}
          badge={dFunding?.bullish == null ? null : dFunding.bullish ? 'BULL' : 'BEAR'}
        />
        <Card
          label="Funding Binance /an"
          value={bFunding?.rateAnn != null ? fmt(bFunding.rateAnn, 2, '%') : '—'}
          sub={`8h: ${bFunding?.rate8h != null ? fmt(bFunding.rate8h, 4, '%') : '—'}`}
          color={pctColor(bFunding?.rateAnn)}
          badge={bFunding?.bullish == null ? null : bFunding.bullish ? 'BULL' : 'BEAR'}
        />
        <Card
          label="Long/Short ratio"
          value={sentiment?.ratio != null ? fmtPure(sentiment.ratio, 3) : '—'}
          sub={`Long ${fmtPure(sentiment?.longPct, 1, '%')} · Short ${fmtPure(sentiment?.shortPct, 1, '%')}`}
          color={sentiment?.bullish == null ? 'var(--text)' : sentiment.bullish ? 'var(--call)' : 'var(--put)'}
          badge={sentiment?.bullish == null ? null : sentiment.bullish ? 'BULL' : 'BEAR'}
        />
        <Card
          label="Taker Buy/Sell"
          value={takerVol?.ratio != null ? fmtPure(takerVol.ratio, 3) : '—'}
          sub="Volume acheteurs / vendeurs"
          color={takerVol?.bullish == null ? 'var(--text)' : takerVol.bullish ? 'var(--call)' : 'var(--put)'}
          badge={takerVol?.bullish == null ? null : takerVol.bullish ? 'BULL' : 'BEAR'}
        />
      </div>

      {/* Funding comparison */}
      <SectionTitle>Funding Rate Perpétuel — Deribit vs Binance</SectionTitle>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', marginBottom: 4 }}>
        {/* En-têtes colonnes */}
        <div style={{
          display: 'grid', gridTemplateColumns: '90px 1fr 1fr 1fr',
          gap: 4, padding: '8px 16px',
          background: 'rgba(255,255,255,.02)', borderBottom: '1px solid var(--border)',
        }}>
          {['Exchange', 'Taux 8h', 'Annualisé', 'Prochain'].map((h, i) => (
            <div key={h} style={{
              fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--sans)',
              fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase',
              textAlign: i === 0 ? 'left' : 'right',
            }}>{h}</div>
          ))}
        </div>
        <FundingRow
          exchange="Deribit" color="var(--accent)"
          rate8h={dFunding?.rate8h}
          rateAnn={dFunding?.rateAnn}
          markPrice={null}
          nextFundingTime={null}
        />
        <FundingRow
          exchange="Binance" color="#F0B90B"
          rate8h={bFunding?.rate8h}
          rateAnn={bFunding?.rateAnn}
          markPrice={bFunding?.markPrice}
          nextFundingTime={bFunding?.nextFundingTime}
        />
        {fundingDiff != null && (
          <div style={{ padding: '8px 16px', borderTop: '1px solid rgba(255,255,255,.04)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Spread Deribit−Binance</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: pctColor(fundingDiff) }}>
              {fmt(fundingDiff, 2, '%/an')}
            </span>
          </div>
        )}
        {avgDFunding30 != null && (
          <div style={{ padding: '8px 16px', borderTop: '1px solid rgba(255,255,255,.04)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Moy. 30 périodes Deribit</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: pctColor(avgDFunding30) }}>
              {fmt(avgDFunding30, 2, '%/an')}
            </span>
          </div>
        )}
      </div>

      {/* Open Interest */}
      <SectionTitle>Open Interest</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 4 }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px' }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--sans)', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 8 }}>Deribit Options OI</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 11, color: 'var(--call)', fontWeight: 700 }}>CALL</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>
                {dOI?.callOI != null ? fmtPure(dOI.callOI, 0) : '—'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 11, color: 'var(--put)', fontWeight: 700 }}>PUT</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>
                {dOI?.putOI != null ? fmtPure(dOI.putOI, 0) : '—'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 4, borderTop: '1px solid var(--border)' }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700 }}>P/C ratio</span>
              <span style={{ fontSize: 13, fontWeight: 800, color: dOI?.putCallRatio > 1 ? 'var(--put)' : 'var(--call)' }}>
                {dOI?.putCallRatio != null ? fmtPure(dOI.putCallRatio, 3) : '—'}
              </span>
            </div>
          </div>
        </div>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px' }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--sans)', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 8 }}>Binance Futures OI</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Total</span>
              <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>
                {bOI?.total != null ? fmtPure(bOI.total, 0) + ' ' + asset : '—'}
              </span>
            </div>
            {bFunding?.markPrice && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Mark Price</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>
                  ${Number(bFunding.markPrice).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </span>
              </div>
            )}
            {bFunding?.indexPrice && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Index Price</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>
                  ${Number(bFunding.indexPrice).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Liquidations */}
      <SectionTitle>Liquidations récentes — Binance</SectionTitle>
      {liquidations ? (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', marginBottom: 4 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 4 }}>Longs liq.</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--put)', fontFamily: 'var(--sans)' }}>
                {fmtUSD(liquidations.longLiqUSD)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 4 }}>Shorts liq.</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--call)', fontFamily: 'var(--sans)' }}>
                {fmtUSD(liquidations.shortLiqUSD)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 4 }}>Total</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', fontFamily: 'var(--sans)' }}>
                {fmtUSD(liquidations.total)}
              </div>
            </div>
          </div>
          {liquidations.recent?.length > 0 && (
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
              <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8 }}>
                Dernières ({liquidations.recent.length})
              </div>
              {liquidations.recent.slice(0, 8).map((l, i) => (
                <div key={i} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '5px 0', borderBottom: i < 7 ? '1px solid rgba(255,255,255,.04)' : 'none',
                }}>
                  <span style={{
                    fontSize: 10, fontWeight: 700,
                    color: l.side === 'SELL' ? 'var(--put)' : 'var(--call)',
                  }}>
                    {l.side === 'SELL' ? 'LONG LIQ' : 'SHORT LIQ'}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text)' }}>
                    ${l.price.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                    {fmtUSD(l.value)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
          {loading ? 'Chargement...' : 'Aucune donnée'}
        </div>
      )}

      {/* Prix de règlement Deribit */}
      {deliveries?.deliveries?.length > 0 && (
        <>
          <SectionTitle>Prix de règlement Deribit (historique)</SectionTitle>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
            {deliveries.deliveries.slice(-6).reverse().map((d, i, arr) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '9px 16px',
                borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,.04)' : 'none',
              }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--sans)' }}>{d.date}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--sans)' }}>
                  ${d.price.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {lastUpdate && (
        <div style={{ textAlign: 'center', fontSize: 10, color: 'var(--text-muted)', opacity: .5, marginTop: 12, marginBottom: 4 }}>
          Mis à jour {lastUpdate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </div>
      )}
    </div>
  )
}
