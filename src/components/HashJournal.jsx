/**
 * HashJournal.jsx
 *
 * Journal unifié de hashage — 4 types d'entrées :
 *   Signal | Anomalie | Pattern | Cache
 *
 * Lecture seule. Aucun appel API. Aucun signal généré.
 */

import { useState, useMemo } from 'react'

const PAGE_SIZE = 30

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtTime(ts) {
  if (!ts) return '—'
  const d = new Date(ts)
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function fmtTimeMs(ts) {
  if (!ts) return '—'
  const d = new Date(ts)
  return d.toLocaleTimeString('fr-FR', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }) + '.' + String(d.getMilliseconds()).padStart(3, '0')
}

// ── Syntaxe highlighting JSON minimal ────────────────────────────────────────

function JsonValue({ value }) {
  if (value === null)             return <span style={{ color: 'var(--text-ghost)' }}>null</span>
  if (typeof value === 'boolean') return <span style={{ color: value ? 'var(--call)' : 'var(--put)' }}>{String(value)}</span>
  if (typeof value === 'number')  return <span style={{ color: 'var(--neutral)' }}>{value}</span>
  if (typeof value === 'string')  return <span style={{ color: 'var(--accent)' }}>"{value}"</span>
  return <span style={{ color: 'var(--text-muted)' }}>{String(value)}</span>
}

function JsonNode({ data, indent = 0 }) {
  const pad = '  '.repeat(indent)
  if (Array.isArray(data)) {
    if (!data.length) return <span style={{ color: 'var(--text-muted)' }}>[]</span>
    return (
      <span>
        {'['}<br />
        {data.map((v, i) => (
          <span key={i}>
            {pad + '  '}
            <JsonNode data={v} indent={indent + 1} />
            {i < data.length - 1 ? ',' : ''}<br />
          </span>
        ))}
        {pad}{']'}
      </span>
    )
  }
  if (typeof data === 'object' && data !== null) {
    const keys = Object.keys(data)
    if (!keys.length) return <span style={{ color: 'var(--text-muted)' }}>{'{}'}</span>
    return (
      <span>
        {'{'}<br />
        {keys.map((k, i) => (
          <span key={k}>
            {pad + '  '}
            <span style={{ color: 'var(--text-muted)' }}>"{k}"</span>
            {': '}
            <JsonNode data={data[k]} indent={indent + 1} />
            {i < keys.length - 1 ? ',' : ''}<br />
          </span>
        ))}
        {pad}{'}'}
      </span>
    )
  }
  return <JsonValue value={data} />
}

// ── CopyButton ────────────────────────────────────────────────────────────────

function CopyHash({ hash }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard?.writeText(hash).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {})
  }
  return (
    <button
      onClick={copy}
      style={{
        background: 'none', border: '1px solid var(--border)',
        borderRadius: 6, padding: '4px 10px', cursor: 'pointer',
        fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 500,
        color: copied ? 'var(--call)' : 'var(--text-muted)',
        transition: 'all 150ms ease',
      }}
    >
      {copied ? 'Copié ✓' : 'Copier hash'}
    </button>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function JournalSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {[1, 2, 3].map(i => (
        <div key={i} style={{
          background: 'var(--bg-surface)', border: '1px solid var(--border)',
          borderRadius: 10, padding: '14px 16px', borderLeft: '3px solid var(--border)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
            <div className="skeleton" style={{ width: 80, height: 12 }} />
            <div className="skeleton" style={{ width: 60, height: 12 }} />
          </div>
          <div className="skeleton" style={{ width: '60%', height: 12, marginBottom: 6 }} />
          <div className="skeleton" style={{ width: '40%', height: 12 }} />
        </div>
      ))}
    </div>
  )
}

// ── Entrée Signal ─────────────────────────────────────────────────────────────

function SignalEntry({ entry }) {
  const [expanded, setExpanded] = useState(false)
  const c = entry.conditions ?? {}
  return (
    <div style={{
      background: 'var(--bg-surface)', border: '1px solid var(--border)',
      borderLeft: '3px solid var(--call)', borderRadius: 10,
      padding: '14px 16px', marginBottom: 8,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontFamily: 'var(--font-body)', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--call)' }}>
          🟢 Signal
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>
          {fmtTime(entry.timestamp)}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px', marginBottom: 10 }}>
        {[
          ['Hash',    entry.hash,           'var(--font-mono)'],
          ['Asset',   entry.asset,          null],
          ['Score',   entry.score != null ? `${entry.score}/100` : '—', null],
          ['Signal',  entry.recommendation, null],
          ['Market ⟠', entry.marketHash,   'var(--font-mono)'],
        ].map(([label, val, font]) => (
          <div key={label}>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: 9, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              {label}
            </div>
            <div style={{ fontFamily: font ?? 'var(--font-body)', fontSize: 12, color: 'var(--text)', marginTop: 2 }}>
              {val ?? '—'}
            </div>
          </div>
        ))}
      </div>

      {Object.keys(c).length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontFamily: 'var(--font-body)', fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6 }}>
            CONDITIONS
          </div>
          {Object.entries(c).map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 2 }}>
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{k}</span>
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text)' }}>{v ?? '—'}</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <CopyHash hash={entry.hash} />
        <button
          onClick={() => setExpanded(e => !e)}
          style={{
            background: 'none', border: '1px solid var(--border)', borderRadius: 6,
            padding: '4px 10px', cursor: 'pointer',
            fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 500,
            color: 'var(--text-muted)', transition: 'all 150ms ease',
          }}
        >
          {expanded ? 'Masquer ▲' : 'Voir détails ▼'}
        </button>
      </div>

      {expanded && (
        <div style={{
          marginTop: 10, background: 'var(--bg-base)', borderRadius: 6,
          padding: '10px 12px', overflowX: 'auto',
          fontFamily: 'var(--font-mono)', fontSize: 11, lineHeight: 1.7,
        }}>
          <JsonNode data={entry} />
        </div>
      )}
    </div>
  )
}

// ── Entrée Anomalie ───────────────────────────────────────────────────────────

function AnomalyEntry({ entry }) {
  const [expanded, setExpanded] = useState(false)
  const isCritical = entry.severity === 'critical'
  const borderColor = isCritical ? 'var(--put)' : 'var(--neutral)'
  const labelColor  = isCritical ? 'var(--put)' : 'var(--neutral)'

  return (
    <div style={{
      background: 'var(--bg-surface)', border: '1px solid var(--border)',
      borderLeft: `3px solid ${borderColor}`, borderRadius: 10,
      padding: '14px 16px', marginBottom: 8,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontFamily: 'var(--font-body)', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: labelColor }}>
          {isCritical ? '🔴 Anomalie critique' : '⚠ Anomalie'}
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>
          {fmtTime(entry.timestamp)}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px', marginBottom: 10 }}>
        {[
          ['Hash',      entry.hash],
          ['Asset',     entry.asset],
          ['Sévérité',  entry.severity?.toUpperCase() ?? '—'],
          ['Indicateurs', entry.count ?? (entry.changedIndicators?.length ?? 0)],
        ].map(([label, val]) => (
          <div key={label}>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: 9, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              {label}
            </div>
            <div style={{ fontFamily: label === 'Hash' ? 'var(--font-mono)' : 'var(--font-body)', fontSize: 12, color: label === 'Sévérité' ? labelColor : 'var(--text)', marginTop: 2 }}>
              {val ?? '—'}
            </div>
          </div>
        ))}
      </div>

      {entry.changedIndicators?.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontFamily: 'var(--font-body)', fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6 }}>
            DÉTAIL
          </div>
          {entry.changedIndicators.map(ind => (
            <div key={ind} style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-dim)', marginBottom: 2 }}>
              → {ind} <span style={{ color: labelColor }}>(changé)</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <CopyHash hash={entry.hash} />
        <button
          onClick={() => setExpanded(e => !e)}
          style={{
            background: 'none', border: '1px solid var(--border)', borderRadius: 6,
            padding: '4px 10px', cursor: 'pointer',
            fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 500,
            color: 'var(--text-muted)', transition: 'all 150ms ease',
          }}
        >
          {expanded ? 'Masquer ▲' : 'Voir détails ▼'}
        </button>
      </div>

      {expanded && (
        <div style={{
          marginTop: 10, background: 'var(--bg-base)', borderRadius: 6,
          padding: '10px 12px', overflowX: 'auto',
          fontFamily: 'var(--font-mono)', fontSize: 11, lineHeight: 1.7,
        }}>
          <JsonNode data={entry} />
        </div>
      )}
    </div>
  )
}

// ── Entrée Pattern ────────────────────────────────────────────────────────────

function PatternEntry({ entry }) {
  const [expanded, setExpanded] = useState(false)
  const cfg = entry.config ?? {}

  return (
    <div style={{
      background: 'var(--bg-surface)', border: '1px solid var(--border)',
      borderLeft: '3px solid var(--accent)', borderRadius: 10,
      padding: '14px 16px', marginBottom: 8,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontFamily: 'var(--font-body)', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--accent)' }}>
          ◈ Pattern
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>—</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px', marginBottom: 10 }}>
        {[
          ['Hash',         entry.hash],
          ['Occurrences',  entry.occurrences],
        ].map(([label, val]) => (
          <div key={label}>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: 9, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              {label}
            </div>
            <div style={{ fontFamily: label === 'Hash' ? 'var(--font-mono)' : 'var(--font-display)', fontSize: 12, color: 'var(--text)', marginTop: 2 }}>
              {val ?? '—'}
            </div>
          </div>
        ))}
      </div>

      {Object.keys(cfg).length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontFamily: 'var(--font-body)', fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6 }}>
            CONFIGURATION
          </div>
          {Object.entries(cfg).map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 2 }}>
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{k}</span>
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text)' }}>{v ?? '—'}</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginBottom: 10 }}>
        <div style={{ fontFamily: 'var(--font-body)', fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6 }}>
          PERFORMANCE
        </div>
        {[
          ['Win Rate 1h',   entry.winRate_1h  != null ? `${entry.winRate_1h}%`                           : '—'],
          ['Win Rate 4h',   entry.winRate_4h  != null ? `${entry.winRate_4h}%`                           : '—'],
          ['Avg Move 24h',  entry.avgMove_24h != null ? `${entry.avgMove_24h > 0 ? '+' : ''}${entry.avgMove_24h}%` : '—'],
        ].map(([label, val]) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 2 }}>
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{label}</span>
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text)' }}>{val}</span>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <CopyHash hash={entry.hash} />
        <button
          onClick={() => setExpanded(e => !e)}
          style={{
            background: 'none', border: '1px solid var(--border)', borderRadius: 6,
            padding: '4px 10px', cursor: 'pointer',
            fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 500,
            color: 'var(--text-muted)', transition: 'all 150ms ease',
          }}
        >
          {expanded ? 'Masquer ▲' : 'Voir détails ▼'}
        </button>
      </div>

      {expanded && (
        <div style={{
          marginTop: 10, background: 'var(--bg-base)', borderRadius: 6,
          padding: '10px 12px', overflowX: 'auto',
          fontFamily: 'var(--font-mono)', fontSize: 11, lineHeight: 1.7,
        }}>
          <JsonNode data={entry} />
        </div>
      )}
    </div>
  )
}

// ── Entrée Cache ──────────────────────────────────────────────────────────────

function CacheEntry({ entry }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard?.writeText(entry.hash).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {})
  }

  return (
    <div style={{
      background: 'var(--bg-surface)', border: '1px solid var(--border)',
      borderLeft: '3px solid var(--border-bright)', borderRadius: 10,
      padding: '12px 16px', marginBottom: 8,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontFamily: 'var(--font-body)', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
          ⚡ Cache
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>
          {fmtTimeMs(entry.ts)}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px', marginBottom: 10 }}>
        {[
          ['Clé',          entry.key],
          ['Hash',         entry.hash],
        ].map(([label, val]) => (
          <div key={label}>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: 9, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              {label}
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text)', marginTop: 2, wordBreak: 'break-all' }}>
              {val ?? '—'}
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={copy}
        style={{
          background: 'none', border: '1px solid var(--border)', borderRadius: 6,
          padding: '4px 10px', cursor: 'pointer',
          fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 500,
          color: copied ? 'var(--call)' : 'var(--text-muted)', transition: 'all 150ms ease',
        }}
      >
        {copied ? 'Copié ✓' : 'Copier hash'}
      </button>
    </div>
  )
}

// ── Composant principal ───────────────────────────────────────────────────────

const FILTER_TABS = [
  { id: 'all',      label: 'Tous' },
  { id: 'signal',   label: 'Signaux' },
  { id: 'anomaly',  label: 'Anomalies' },
  { id: 'pattern',  label: 'Patterns' },
  { id: 'cache',    label: 'Cache' },
]

/**
 * @param {{
 *   signalHistory : array,
 *   anomalyLog    : array,
 *   patterns      : array,
 *   cacheChanges  : array,
 *   loading       : boolean,
 *   onRefresh     : () => void,
 * }} props
 */
export default function HashJournal({
  signalHistory  = [],
  anomalyLog     = [],
  patterns       = [],
  cacheChanges   = [],
  loading        = false,
  onRefresh,
}) {
  const [filter, setFilter]   = useState('all')
  const [search, setSearch]   = useState('')
  const [page,   setPage]     = useState(1)

  // Fusion + tri chronologique descendant
  const allEntries = useMemo(() => {
    const signals  = signalHistory.map(e => ({ ...e, _type: 'signal'  }))
    const anomalies = anomalyLog.map(e => ({ ...e, _type: 'anomaly' }))
    const pats      = patterns.map(e => ({ ...e, _type: 'pattern', timestamp: null }))
    const cache     = cacheChanges.map(e => ({ ...e, _type: 'cache', timestamp: e.ts }))

    const merged = [...signals, ...anomalies, ...pats, ...cache]
    merged.sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0))
    return merged
  }, [signalHistory, anomalyLog, patterns, cacheChanges])

  const filtered = useMemo(() => {
    let list = filter === 'all' ? allEntries : allEntries.filter(e => e._type === filter.replace('s', '').replace('anomaly', 'anomaly').replace('pattern', 'pattern'))

    // Correction du filtre pour les pluriels
    if (filter === 'signal')  list = allEntries.filter(e => e._type === 'signal')
    if (filter === 'anomaly') list = allEntries.filter(e => e._type === 'anomaly')
    if (filter === 'pattern') list = allEntries.filter(e => e._type === 'pattern')
    if (filter === 'cache')   list = allEntries.filter(e => e._type === 'cache')

    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(e =>
        e.hash?.toLowerCase().includes(q) ||
        e.key?.toLowerCase().includes(q) ||
        e.asset?.toLowerCase().includes(q)
      )
    }
    return list
  }, [allEntries, filter, search])

  const paginated = filtered.slice(0, page * PAGE_SIZE)
  const hasMore   = paginated.length < filtered.length

  // Reset page quand filtre/search change
  const handleFilter = (f) => { setFilter(f); setPage(1) }
  const handleSearch = (v) => { setSearch(v);  setPage(1) }

  const counts = {
    signal:  signalHistory.length,
    anomaly: anomalyLog.length,
    pattern: patterns.length,
    cache:   cacheChanges.length,
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
            JOURNAL DE HASHAGE
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {[
              { label: 'Signaux',   count: counts.signal,  color: 'var(--call)' },
              { label: 'Anomalies', count: counts.anomaly, color: 'var(--neutral)' },
              { label: 'Patterns',  count: counts.pattern, color: 'var(--accent)' },
              { label: 'Cache',     count: counts.cache,   color: 'var(--border-bright)' },
            ].map(({ label, count, color }) => (
              <div key={label} style={{
                display: 'flex', alignItems: 'center', gap: 5, padding: '3px 9px',
                background: 'var(--bg-surface-2)', border: '1px solid var(--border)',
                borderRadius: 6,
              }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
                <span style={{ fontFamily: 'var(--font-body)', fontSize: 10, color: 'var(--text-muted)' }}>
                  {label}
                </span>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 700, color: 'var(--text)' }}>
                  {count}
                </span>
              </div>
            ))}
          </div>
        </div>
        <button
          onClick={onRefresh}
          style={{
            background: 'none', border: '1px solid var(--border)', borderRadius: 8,
            padding: '7px 12px', cursor: 'pointer',
            fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 600,
            color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 5,
            transition: 'all 150ms ease', flexShrink: 0,
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="23 4 23 10 17 10"/>
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
          </svg>
          Actualiser
        </button>
      </div>

      {/* Onglets filtre */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 12, flexWrap: 'wrap' }}>
        {FILTER_TABS.map(t => (
          <button
            key={t.id}
            onClick={() => handleFilter(t.id)}
            style={{
              padding: '5px 12px', borderRadius: 6, cursor: 'pointer',
              fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 600,
              border: '1px solid',
              borderColor: filter === t.id ? 'var(--accent)' : 'var(--border)',
              background:  filter === t.id ? 'var(--accent-dim)' : 'transparent',
              color:        filter === t.id ? 'var(--accent)' : 'var(--text-muted)',
              transition: 'all 150ms ease',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Barre de recherche */}
      <div style={{ position: 'relative', marginBottom: 14 }}>
        <input
          type="text"
          value={search}
          onChange={e => handleSearch(e.target.value)}
          placeholder="Rechercher un hash..."
          style={{
            width: '100%', padding: '8px 32px 8px 12px',
            background: 'var(--bg-surface)', border: '1px solid var(--border)',
            borderRadius: 8, color: 'var(--text)', fontSize: 12,
            fontFamily: 'var(--font-mono)', outline: 'none',
          }}
        />
        {search && (
          <button
            onClick={() => handleSearch('')}
            style={{
              position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-muted)', fontSize: 14, lineHeight: 1,
            }}
          >
            ×
          </button>
        )}
      </div>

      {/* Liste */}
      {loading ? (
        <JournalSkeleton />
      ) : paginated.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: 28, marginBottom: 10 }}>◻</div>
          <div style={{ fontFamily: 'var(--font-body)', fontSize: 13 }}>
            Aucune entrée dans ce journal
          </div>
        </div>
      ) : (
        <>
          {paginated.map((entry, i) => {
            const key = `${entry._type}-${entry.hash ?? i}-${i}`
            if (entry._type === 'signal')  return <SignalEntry  key={key} entry={entry} />
            if (entry._type === 'anomaly') return <AnomalyEntry key={key} entry={entry} />
            if (entry._type === 'pattern') return <PatternEntry key={key} entry={entry} />
            if (entry._type === 'cache')   return <CacheEntry   key={key} entry={entry} />
            return null
          })}

          {hasMore && (
            <button
              onClick={() => setPage(p => p + 1)}
              style={{
                width: '100%', padding: '10px', marginTop: 4,
                background: 'none', border: '1px solid var(--border)',
                borderRadius: 10, cursor: 'pointer',
                fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 600,
                color: 'var(--text-muted)', transition: 'all 150ms ease',
              }}
            >
              Charger plus ({filtered.length - paginated.length} restants)
            </button>
          )}
        </>
      )}
    </div>
  )
}
