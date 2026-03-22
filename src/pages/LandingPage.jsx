export default function LandingPage({ onEnter, version }) {
  return (
    <div style={{
      height: '100dvh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)', padding: '32px 24px', textAlign: 'center',
    }}>
      {/* Logo */}
      <div style={{
        width: 72, height: 72, borderRadius: 20,
        background: 'rgba(0,212,255,.12)', border: '1px solid rgba(0,212,255,.25)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24,
      }}>
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
        </svg>
      </div>

      {/* Title */}
      <div style={{ marginBottom: 12 }}>
        <div style={{
          fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 32,
          color: 'var(--text)', letterSpacing: '-1px', lineHeight: 1.1,
        }}>
          Veri<span style={{ color: 'var(--accent)' }}>dex</span>
        </div>
        <div style={{
          fontSize: 11, color: 'var(--text-muted)', letterSpacing: '2px',
          textTransform: 'uppercase', marginTop: 4,
        }}>
          Market Intelligence. Verified.
        </div>
      </div>

      {/* Description */}
      <p style={{
        fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.7,
        maxWidth: 280, marginBottom: 40,
      }}>
        Analyse cross-exchange · Signaux composites · Données vérifiées
      </p>

      {/* Features */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 40, width: '100%', maxWidth: 280 }}>
        {[
          { icon: '📊', label: 'Market', desc: 'Spot · Futures · Funding' },
          { icon: '〰️', label: 'Options', desc: 'DVOL · IV Rank · Greeks' },
          { icon: '⚡', label: 'Signaux', desc: 'Score composite 0-100' },
          { icon: '🔗', label: 'On-Chain', desc: 'Mempool · Flows · Mining' },
          { icon: '📋', label: 'Trade', desc: 'Paper trading simulé' },
        ].map(f => (
          <div key={f.label} style={{
            display: 'flex', alignItems: 'center', gap: 12,
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 12, padding: '10px 14px', textAlign: 'left',
          }}>
            <span style={{ fontSize: 18 }}>{f.icon}</span>
            <div>
              <div style={{ fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>{f.label}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{f.desc}</div>
            </div>
          </div>
        ))}
      </div>

      {/* CTA */}
      <button
        onClick={onEnter}
        style={{
          padding: '14px 40px', borderRadius: 14, border: 'none', cursor: 'pointer',
          background: 'var(--accent)', color: '#000',
          fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 15, letterSpacing: '.5px',
          width: '100%', maxWidth: 280,
        }}
      >
        Accéder
      </button>

      <div style={{ marginTop: 16, fontSize: 10, color: 'var(--text-muted)', opacity: .4 }}>
        v{version} · Deribit · Binance · Coinbase
      </div>
    </div>
  )
}
