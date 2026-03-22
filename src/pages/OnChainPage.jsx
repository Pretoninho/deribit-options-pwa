import { useState, useEffect, useRef } from 'react'
import { getOnChainSnapshot }       from '../data_core/providers/onchain.js'
import { normalizeOnChain }         from '../data_core/normalizers/format_data.js'
import {
  detectExchangeFlowSignal,
  detectMempoolSignal,
  detectMinerSignal,
  compositeOnChainSignal,
} from '../data_processing/signals/onchain_signals.js'

const POLL_MS = 60_000  // 60 secondes

// ── Helpers UI ────────────────────────────────────────────────────────────────

function fmt(v, decimals = 0) {
  if (v == null) return '—'
  return Number(v).toLocaleString('fr-FR', { maximumFractionDigits: decimals })
}

function ScoreRing({ score, size = 96 }) {
  if (score == null) return null
  const r  = size * 0.4
  const cx = size / 2
  const circ = 2 * Math.PI * r
  const color = score >= 65 ? 'var(--call)' : score >= 45 ? 'var(--atm)' : 'var(--put)'

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cx} r={r} fill="none" stroke="rgba(255,255,255,.06)" strokeWidth={size * 0.07} />
      <circle
        cx={cx} cy={cx} r={r} fill="none"
        stroke={color} strokeWidth={size * 0.07}
        strokeDasharray={`${circ * score / 100} ${circ}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cx})`}
        style={{ transition: 'stroke-dasharray .6s' }}
      />
      <text
        x={cx} y={cx + 1} textAnchor="middle" dominantBaseline="middle"
        fill={color}
        style={{ fontFamily: 'var(--sans)', fontWeight: 900, fontSize: size * 0.22 }}
      >
        {score}
      </text>
    </svg>
  )
}

function ProgressBar({ value, max, color }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div style={{ height: 5, background: 'rgba(255,255,255,.06)', borderRadius: 3, overflow: 'hidden', marginTop: 6 }}>
      <div style={{
        height: '100%', width: `${pct}%`, background: color,
        borderRadius: 3, transition: 'width .5s',
      }} />
    </div>
  )
}

const CONGESTION_COLOR = {
  low:      'var(--call)',
  medium:   'var(--atm)',
  high:     'var(--accent2)',
  critical: 'var(--put)',
}

const CONGESTION_LABEL = {
  low:      'Calme',
  medium:   'Modéré',
  high:     'Élevé',
  critical: 'Critique',
}

const FLOW_COLOR = {
  accumulation: 'var(--call)',
  neutral:      'var(--text-dim)',
  distribution: 'var(--put)',
}

const FLOW_LABEL = {
  accumulation: 'Accumulation',
  neutral:      'Neutre',
  distribution: 'Distribution',
}

// ── Card composant ─────────────────────────────────────────────────────────────

function Card({ children, style }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 14, padding: '14px 16px', marginBottom: 12,
      ...style,
    }}>
      {children}
    </div>
  )
}

function SectionTitle({ children }) {
  return (
    <div style={{
      fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--sans)',
      fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 12,
    }}>
      {children}
    </div>
  )
}

// ── Page principale ────────────────────────────────────────────────────────────

export default function OnChainPage({ asset }) {
  const [data,       setData]       = useState(null)
  const [signals,    setSignals]    = useState(null)
  const [composite,  setComposite]  = useState(null)
  const [loading,    setLoading]    = useState(false)
  const [lastUpdate, setLastUpdate] = useState(null)
  const [error,      setError]      = useState(null)
  const [noviceMode, setNoviceMode] = useState(false)
  const timerRef = useRef(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const raw        = await getOnChainSnapshot(asset)
      const normalized = normalizeOnChain(raw)

      const flowSig    = detectExchangeFlowSignal(normalized.exchangeFlow)
      const mempoolSig = detectMempoolSignal(normalized.mempool)
      const minerSig   = detectMinerSignal(normalized.mining)
      const comp       = compositeOnChainSignal(
        flowSig, mempoolSig, minerSig,
        normalized.composite.onChainScore,
      )

      setData(normalized)
      setSignals({ flow: flowSig, mempool: mempoolSig, miner: minerSig })
      setComposite(comp)
      setLastUpdate(new Date())
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }

  useEffect(() => {
    load()
    timerRef.current = setInterval(load, POLL_MS)
    return () => clearInterval(timerRef.current)
  }, [asset])

  const score = composite?.score ?? null
  const scoreColor = score >= 65 ? 'var(--call)' : score >= 45 ? 'var(--atm)' : 'var(--put)'
  const biasLabel = data?.composite?.bias === 'bullish' ? 'Haussier'
    : data?.composite?.bias === 'bearish' ? 'Baissier'
    : 'Neutre'

  return (
    <div className="page-wrap fade-in">

      {/* ── Header ── */}
      <div className="page-header">
        <div className="page-title">
          On-Chain <span style={{ color: 'var(--accent)', fontSize: 14 }}>{asset}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {loading && <div className="dot-live" />}
          <button
            onClick={load} disabled={loading}
            style={{
              background: 'none', border: '1px solid var(--border)', borderRadius: 8,
              color: 'var(--text-muted)', fontSize: 11, padding: '4px 10px',
              cursor: 'pointer', fontFamily: 'var(--sans)', fontWeight: 600,
            }}
          >
            {loading ? '...' : 'Refresh'}
          </button>
        </div>
      </div>

      {error && (
        <div style={{
          background: 'rgba(255,77,109,.08)', border: '1px solid rgba(255,77,109,.25)',
          borderRadius: 10, padding: '10px 14px', marginBottom: 12, fontSize: 12, color: 'var(--put)',
        }}>
          {error}
        </div>
      )}

      {/* ── Score global ── */}
      <Card style={{ textAlign: 'center', padding: '22px 16px' }}>
        <ScoreRing score={score} size={100} />
        <div style={{
          fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 17,
          color: scoreColor, marginTop: 10,
        }}>
          {biasLabel}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
          Confiance : {data?.composite?.confidence ?? '—'} &nbsp;·&nbsp;
          {lastUpdate ? `màj ${lastUpdate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : 'chargement...'}
        </div>
      </Card>

      {/* ── Section : 3 cartes indicateurs ── */}
      <SectionTitle>Indicateurs</SectionTitle>

      {/* Card Mempool */}
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
          <div>
            <div style={{ fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 13, color: 'var(--text)', marginBottom: 3 }}>
              Mempool Bitcoin
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {fmt(data?.mempool?.txCount)} tx en attente
            </div>
          </div>
          <div style={{
            background: data?.mempool?.congestion ? `${CONGESTION_COLOR[data.mempool.congestion]}22` : 'transparent',
            border: `1px solid ${data?.mempool?.congestion ? CONGESTION_COLOR[data.mempool.congestion] : 'var(--border)'}55`,
            borderRadius: 8, padding: '4px 10px',
            color: data?.mempool?.congestion ? CONGESTION_COLOR[data.mempool.congestion] : 'var(--text-muted)',
            fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 11,
          }}>
            {data?.mempool?.congestion ? CONGESTION_LABEL[data.mempool.congestion] : '—'}
          </div>
        </div>
        <ProgressBar
          value={data?.mempool?.txCount ?? 0}
          max={100_000}
          color={data?.mempool?.congestion ? CONGESTION_COLOR[data.mempool.congestion] : 'var(--border)'}
        />
        <div style={{ display: 'flex', gap: 16, marginTop: 10, flexWrap: 'wrap' }}>
          {[
            { label: 'Rapide',  val: data?.mempool?.fastFee },
            { label: '1 heure', val: data?.mempool?.hourFee },
          ].map(({ label, val }) => (
            <div key={label}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{label}</div>
              <div style={{ fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 13, color: 'var(--atm)' }}>
                {val != null ? `${val} sat/vB` : '—'}
              </div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 10, lineHeight: 1.5 }}>
          {signals?.mempool?.description_expert?.slice(0, 100)}…
        </div>
      </Card>

      {/* Card Exchange Flows */}
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
          <div>
            <div style={{ fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 13, color: 'var(--text)', marginBottom: 3 }}>
              Flux Exchange
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              Netflow net {asset}
            </div>
          </div>
          <div style={{
            background: signals?.flow?.signal
              ? `${FLOW_COLOR[signals.flow.signal.toLowerCase()]}22`
              : 'transparent',
            border: `1px solid ${signals?.flow?.signal ? FLOW_COLOR[signals.flow.signal.toLowerCase()] : 'var(--border)'}55`,
            borderRadius: 8, padding: '4px 10px',
            color: signals?.flow?.signal ? FLOW_COLOR[signals.flow.signal.toLowerCase()] : 'var(--text-muted)',
            fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 11,
          }}>
            {signals?.flow?.signal ? FLOW_LABEL[signals.flow.signal.toLowerCase()] : '—'}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          {/* Flèche directionnelle */}
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: signals?.flow?.signal === 'ACCUMULATION' ? 'rgba(0,229,160,.1)' : signals?.flow?.signal === 'DISTRIBUTION' ? 'rgba(255,77,109,.1)' : 'rgba(255,255,255,.04)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={
              signals?.flow?.signal === 'ACCUMULATION' ? 'var(--call)' :
              signals?.flow?.signal === 'DISTRIBUTION' ? 'var(--put)' : 'var(--text-muted)'
            } strokeWidth="2.5">
              {signals?.flow?.signal === 'ACCUMULATION'
                ? <path d="M12 19V5M5 12l7-7 7 7" />
                : signals?.flow?.signal === 'DISTRIBUTION'
                ? <path d="M12 5v14M5 12l7 7 7-7" />
                : <path d="M5 12h14" />
              }
            </svg>
          </div>
          <div>
            <div style={{ fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 15, color: 'var(--text)' }}>
              {data?.exchangeFlow?.netflow != null
                ? `${data.exchangeFlow.netflow > 0 ? '+' : ''}${fmt(data.exchangeFlow.netflow)} BTC`
                : '—'}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
              Intensité : {signals?.flow?.strength ?? '—'}
            </div>
          </div>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.5 }}>
          {signals?.flow?.description_expert?.slice(0, 110)}…
        </div>
      </Card>

      {/* Card Mining */}
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
          <div>
            <div style={{ fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 13, color: 'var(--text)', marginBottom: 3 }}>
              Mining
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              Hash rate & difficulté
            </div>
          </div>
          <div style={{
            background: signals?.miner?.signal === 'BULLISH' ? 'rgba(0,229,160,.12)' : signals?.miner?.signal === 'BEARISH' ? 'rgba(255,77,109,.12)' : 'rgba(255,255,255,.04)',
            border: `1px solid ${signals?.miner?.signal === 'BULLISH' ? 'rgba(0,229,160,.3)' : signals?.miner?.signal === 'BEARISH' ? 'rgba(255,77,109,.3)' : 'var(--border)'}`,
            borderRadius: 8, padding: '4px 10px',
            color: signals?.miner?.signal === 'BULLISH' ? 'var(--call)' : signals?.miner?.signal === 'BEARISH' ? 'var(--put)' : 'var(--text-muted)',
            fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 11,
          }}>
            {signals?.miner?.signal ?? '—'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 20 }}>
          <div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Hash Rate</div>
            <div style={{ fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>
              {data?.mining?.hashRate != null
                ? `${(data.mining.hashRate / 1e18).toFixed(1)} EH/s`
                : '—'}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Difficulté</div>
            <div style={{ fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>
              {data?.mining?.difficulty != null
                ? `${(data.mining.difficulty / 1e12).toFixed(1)}T`
                : '—'}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Tendance</div>
            <div style={{ fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>
              {signals?.miner?.trend === 'up' ? '↑' : signals?.miner?.trend === 'down' ? '↓' : '→'}
            </div>
          </div>
        </div>
      </Card>

      {/* ── Section : Signal composite ── */}
      <SectionTitle style={{ marginTop: 4 }}>Signal composite</SectionTitle>

      {composite ? (
        <Card style={{ padding: '16px' }}>
          {/* Toggle Expert / Novice */}
          <div style={{ display: 'flex', gap: 0, marginBottom: 16, background: 'rgba(255,255,255,.04)', borderRadius: 10, padding: 3 }}>
            {[
              { label: 'Expert', val: false },
              { label: 'Novice', val: true },
            ].map(({ label, val }) => (
              <button
                key={label}
                onClick={() => setNoviceMode(val)}
                style={{
                  flex: 1, padding: '7px 0', border: 'none', borderRadius: 8, cursor: 'pointer',
                  fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 12,
                  background: noviceMode === val ? 'var(--accent)' : 'transparent',
                  color: noviceMode === val ? 'var(--bg)' : 'var(--text-muted)',
                  transition: 'background .2s, color .2s',
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {!noviceMode ? (
            /* ── Mode Expert ── */
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.7, marginBottom: 14 }}>
                {composite.expert}
              </div>
              <div style={{
                background: 'rgba(0,212,255,.06)', border: '1px solid rgba(0,212,255,.2)',
                borderRadius: 10, padding: '10px 14px',
                fontSize: 12, color: 'var(--accent)', lineHeight: 1.6,
              }}>
                <span style={{ fontFamily: 'var(--sans)', fontWeight: 700 }}>Action : </span>
                {composite.action_expert}
              </div>
            </div>
          ) : (
            /* ── Mode Novice ── */
            <div>
              <div style={{
                fontSize: 14, color: 'var(--text-dim)', fontStyle: 'italic', marginBottom: 12, lineHeight: 1.6,
              }}>
                {composite.novice.metaphor}
              </div>
              {[
                { label: 'Situation', val: composite.novice.situation, color: 'var(--text)'     },
                { label: 'Quoi faire', val: composite.novice.action,    color: 'var(--accent)'  },
                { label: 'Potentiel', val: composite.novice.gain,      color: 'var(--call)'    },
                { label: 'Risque',    val: composite.novice.risk,      color: 'var(--accent2)' },
              ].map(({ label, val, color }) => (
                <div key={label} style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--sans)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 3 }}>
                    {label}
                  </div>
                  <div style={{ fontSize: 12, color, lineHeight: 1.6 }}>
                    {val}
                  </div>
                </div>
              ))}
              <div style={{
                background: 'rgba(0,212,255,.06)', border: '1px solid rgba(0,212,255,.2)',
                borderRadius: 10, padding: '10px 14px', marginTop: 4,
                fontSize: 12, color: 'var(--accent)', lineHeight: 1.6,
              }}>
                <span style={{ fontFamily: 'var(--sans)', fontWeight: 700 }}>Action : </span>
                {composite.action_novice}
              </div>
            </div>
          )}
        </Card>
      ) : (
        <Card>
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12, padding: '16px 0' }}>
            {loading ? 'Chargement des données on-chain...' : 'Appuie sur Refresh pour charger'}
          </div>
        </Card>
      )}
    </div>
  )
}
