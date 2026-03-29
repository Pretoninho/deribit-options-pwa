/**
 * PatternAuditLog.jsx
 *
 * Affiche le journal d'audit des détections de patterns de marché.
 * Chaque ligne = un appel à recordPattern avec les valeurs mesurées + le fingerprint.
 * Auto-refresh toutes les 5s. Lecture seule.
 */

import { useState, useEffect, useCallback } from 'react'
import { getPatternAuditLog, clearPatternAuditLog } from '../../signals/pattern_audit.js'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtTs(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'medium' })
}

function fmtNum(v, decimals = 1) {
  if (v == null) return '—'
  return Number(v).toFixed(decimals)
}

// ── ConfigChips — badges buckets fingerprint ──────────────────────────────────

function ConfigChips({ config }) {
  if (!config) return <span style={{ color: 'var(--text-ghost)', fontSize: 10 }}>—</span>

  const chips = [
    config.ivRankBucket  != null && { label: 'IV',   val: config.ivRankBucket },
    config.fundingBucket != null && { label: 'F',    val: `${config.fundingBucket}%` },
    config.spreadBucket           && { label: 'Spr', val: config.spreadBucket },
    config.lsBucket               && { label: 'L/S', val: config.lsBucket },
    config.basisBucket            && { label: 'Bas', val: config.basisBucket },
  ].filter(Boolean)

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
      {chips.map(c => (
        <span key={c.label} style={{
          fontFamily: 'var(--font-mono)', fontSize: 9,
          padding: '2px 5px', borderRadius: 3,
          background: 'var(--bg-surface)', border: '1px solid var(--border)',
          color: 'var(--text-muted)',
          whiteSpace: 'nowrap',
        }}>
          {c.label}:{c.val}
        </span>
      ))}
    </div>
  )
}

// ── InputsRow — valeurs brutes mesurées ───────────────────────────────────────

function InputsRow({ inputs }) {
  if (!inputs) return null
  const items = [
    inputs.ivRank   != null && `IV Rank: ${fmtNum(inputs.ivRank, 1)}`,
    inputs.fundingAnn != null && `F ann.: ${fmtNum(inputs.fundingAnn, 2)}%`,
    inputs.lsRatio  != null && `L/S: ${fmtNum(inputs.lsRatio, 3)}`,
    inputs.basisPct != null && `Basis: ${fmtNum(inputs.basisPct, 2)}%`,
  ].filter(Boolean)

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {items.map(item => (
        <span key={item} style={{
          fontFamily: 'var(--font-mono)', fontSize: 9,
          color: 'var(--text-ghost)',
        }}>
          {item}
        </span>
      ))}
    </div>
  )
}

// ── PatternAuditLog ───────────────────────────────────────────────────────────

export default function PatternAuditLog() {
  const [entries, setEntries] = useState([])
  const [open,    setOpen]    = useState(true)

  const refresh = useCallback(() => {
    setEntries(getPatternAuditLog(30))
  }, [])

  useEffect(() => {
    refresh()
    const id = setInterval(refresh, 5_000)
    return () => clearInterval(id)
  }, [refresh])

  function handleClear() {
    clearPatternAuditLog()
    setEntries([])
  }

  return (
    <div className="card">
      {/* Header */}
      <div
        className="card-header"
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
      >
        <span
          style={{ cursor: 'pointer', userSelect: 'none', display: 'flex', alignItems: 'center', gap: 6 }}
          onClick={() => setOpen(o => !o)}
        >
          Journal audit — détections patterns
          <span className="fp-badge">{entries.length}</span>
          <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 2 }}>
            {open ? '▲' : '▼'}
          </span>
        </span>
        {open && entries.length > 0 && (
          <button
            onClick={handleClear}
            style={{
              background: 'none', border: '1px solid var(--border)', borderRadius: 5,
              color: 'var(--text-muted)', fontSize: 10, padding: '2px 8px', cursor: 'pointer',
              fontFamily: 'var(--font-body)',
            }}
          >
            Vider
          </button>
        )}
      </div>

      {/* Body */}
      {open && (
        entries.length === 0 ? (
          <div style={{
            padding: '20px 16px', textAlign: 'center',
            fontFamily: 'var(--font-body)', fontSize: 12,
            color: 'var(--text-ghost)', fontStyle: 'italic',
          }}>
            Aucune détection enregistrée — le journal se peuple à chaque refresh de signal.
          </div>
        ) : (
          <div style={{ maxHeight: 340, overflowY: 'auto' }}>
            {/* Colonne header */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '110px 50px 80px 1fr 44px 44px',
              gap: 8, padding: '5px 14px',
              borderBottom: '1px solid var(--border)',
              position: 'sticky', top: 0,
              background: 'var(--bg-surface)',
            }}>
              {['Timestamp', 'Asset', 'Hash', 'Fingerprint / Inputs', 'Obs', 'News'].map(h => (
                <span key={h} style={{
                  fontFamily: 'var(--font-body)', fontSize: 9,
                  color: 'var(--text-ghost)', textTransform: 'uppercase', letterSpacing: '0.4px',
                }}>
                  {h}
                </span>
              ))}
            </div>

            {entries.map((e, i) => {
              const nw = e.newsWindow
              return (
                <div key={i} style={{
                  display: 'grid',
                  gridTemplateColumns: '110px 50px 80px 1fr 44px 44px',
                  alignItems: 'start',
                  gap: 8,
                  padding: '8px 14px',
                  borderBottom: '1px solid rgba(46,51,64,.4)',
                  background: nw?.inWindow ? 'rgba(240,71,107,.04)' : undefined,
                }}>
                  {/* Timestamp */}
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-ghost)' }}>
                    {fmtTs(e.ts)}
                  </span>

                  {/* Asset */}
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', fontWeight: 700 }}>
                    {e.asset ?? '—'}
                  </span>

                  {/* Hash court + spot */}
                  <div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>
                      {e.hash?.slice(0, 8) ?? '—'}
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-ghost)' }}>
                      ${e.spot != null ? e.spot.toLocaleString('en-US', { maximumFractionDigits: 0 }) : '—'}
                    </div>
                  </div>

                  {/* Fingerprint buckets + valeurs mesurées */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <ConfigChips config={e.config} />
                    <InputsRow inputs={e.inputs} />
                  </div>

                  {/* Occurrences */}
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: 12,
                    color: 'var(--accent)', fontWeight: 700,
                    whiteSpace: 'nowrap',
                  }}>
                    {e.occurrences ?? 0}×
                  </span>

                  {/* News window flag */}
                  <div title={nw?.event ? `${nw.event.currency} ${nw.event.event} (±${nw.minutesAway}min)` : undefined}>
                    {nw?.inWindow ? (
                      <span style={{
                        fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700,
                        color: 'var(--put)',
                        padding: '2px 5px', borderRadius: 3,
                        background: 'rgba(240,71,107,.12)', border: '1px solid rgba(240,71,107,.3)',
                        whiteSpace: 'nowrap',
                        display: 'inline-block',
                      }}>
                        {nw.isPre ? '▶' : '◀'} {nw.event?.currency ?? 'NEWS'}
                      </span>
                    ) : nw?.minutesAway != null && nw.minutesAway < 60 ? (
                      <span style={{
                        fontFamily: 'var(--font-mono)', fontSize: 9,
                        color: 'var(--neutral)', whiteSpace: 'nowrap',
                      }}>
                        ~{nw.minutesAway}min
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-ghost)', fontSize: 9 }}>—</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )
      )}
    </div>
  )
}
