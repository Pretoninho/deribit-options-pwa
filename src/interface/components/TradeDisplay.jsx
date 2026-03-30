import { useState } from 'react'

/**
 * TradeDisplay - Affiche un objet trade structuré avec JSON formaté et bouton de copie
 *
 * Props:
 * - trade: Objet trade structuré { type, direction, strike, lot, stopLoss, takeProfit, confidence, validity, ... }
 * - signal: Objet signal pour contexte supplémentaire
 * - showJSON: Afficher le bloc JSON (défaut: true)
 * - compact: Mise en page compacte verticale (défaut: false)
 */
export default function TradeDisplay({ trade, signal, showJSON = true, compact = false }) {
  const [copied, setCopied] = useState(false)

  if (!trade) {
    return (
      <div style={{ textAlign: 'center', padding: '16px 0', fontSize: 12, color: 'var(--text-muted)' }}>
        Aucun trade à afficher
      </div>
    )
  }

  // Prépare l'objet pour la copie JSON (sans les champs legacy)
  const displayTrade = {
    type: trade.type,
    direction: trade.direction,
    strike: trade.strike,
    lot: trade.lot,
    stopLoss: trade.stopLoss,
    takeProfit: trade.takeProfit,
    confidence: trade.confidence,
    validity: trade.validity,
  }

  const jsonStr = JSON.stringify(displayTrade, null, 2)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(jsonStr)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Copie échouée:', err)
    }
  }

  // Helper pour formater les nombres
  function fmt(n, digits = 2) {
    if (!Number.isFinite(n)) return '—'
    return n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })
  }

  function fmtUsd(n) {
    if (!Number.isFinite(n)) return '—'
    return '$' + fmt(n)
  }

  // Détermine la couleur basée sur la direction
  const directionColor = trade.direction === 'LONG' ? 'var(--call)' : 'var(--put)'

  // Détermine la couleur de la confiance
  const confidenceColor =
    trade.confidence >= 70 ? 'var(--call)' :
    trade.confidence >= 50 ? 'var(--atm)' :
    'var(--put)'

  return (
    <div>
      {/* Grille d'aperçu rapide */}
      <div style={{
        display: compact ? 'flex' : 'grid',
        flexDirection: compact ? 'column' : undefined,
        gridTemplateColumns: compact ? undefined : '1fr 1fr',
        gap: 10,
        marginBottom: showJSON ? 14 : 0,
      }}>
        {/* Type de trade */}
        <div style={{ background: 'rgba(255,255,255,.03)', borderRadius: 10, padding: '10px 14px' }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 4 }}>
            Type
          </div>
          <div style={{ fontFamily: 'var(--mono)', fontWeight: 600, fontSize: 14, color: directionColor }}>
            {trade.type} {trade.direction}
          </div>
        </div>

        {/* Confiance */}
        <div style={{ background: 'rgba(255,255,255,.03)', borderRadius: 10, padding: '10px 14px' }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 4 }}>
            Confiance
          </div>
          <div style={{ fontFamily: 'var(--mono)', fontWeight: 600, fontSize: 14, color: confidenceColor }}>
            {trade.confidence}%
          </div>
        </div>

        {/* Strike */}
        <div style={{ background: 'rgba(255,255,255,.03)', borderRadius: 10, padding: '10px 14px' }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 4 }}>
            Strike
          </div>
          <div style={{ fontFamily: 'var(--mono)', fontWeight: 600, fontSize: 14, color: 'var(--text-bright)' }}>
            {fmtUsd(trade.strike)}
          </div>
        </div>

        {/* Lot */}
        <div style={{ background: 'rgba(255,255,255,.03)', borderRadius: 10, padding: '10px 14px' }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 4 }}>
            Lot
          </div>
          <div style={{ fontFamily: 'var(--mono)', fontWeight: 600, fontSize: 14, color: 'var(--text-bright)' }}>
            {trade.lot}
          </div>
        </div>

        {/* Stop Loss */}
        <div style={{ background: 'rgba(240,71,107,.05)', border: '1px solid rgba(240,71,107,.15)', borderRadius: 10, padding: '10px 14px' }}>
          <div style={{ fontSize: 10, color: 'var(--put)', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 4 }}>
            Stop Loss
          </div>
          <div style={{ fontFamily: 'var(--mono)', fontWeight: 600, fontSize: 14, color: 'var(--put)' }}>
            {fmtUsd(trade.stopLoss)}
          </div>
        </div>

        {/* Take Profit */}
        <div style={{ background: 'rgba(0,200,150,.05)', border: '1px solid rgba(0,200,150,.15)', borderRadius: 10, padding: '10px 14px' }}>
          <div style={{ fontSize: 10, color: 'var(--call)', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 4 }}>
            Take Profit
          </div>
          <div style={{ fontFamily: 'var(--mono)', fontWeight: 600, fontSize: 14, color: 'var(--call)' }}>
            {fmtUsd(trade.takeProfit)}
          </div>
        </div>

        {/* Validity */}
        <div style={{ background: 'rgba(255,255,255,.03)', borderRadius: 10, padding: '10px 14px' }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 4 }}>
            Validité
          </div>
          <div style={{ fontFamily: 'var(--mono)', fontWeight: 600, fontSize: 14, color: 'var(--text-bright)' }}>
            {trade.validity}
          </div>
        </div>
      </div>

      {/* Bloc JSON avec copie */}
      {showJSON && (
        <div style={{ marginTop: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase' }}>
              JSON structuré
            </div>
            <button
              onClick={handleCopy}
              style={{
                background: copied ? 'rgba(0,200,150,.15)' : 'rgba(255,255,255,.05)',
                border: `1px solid ${copied ? 'rgba(0,200,150,.3)' : 'var(--border)'}`,
                borderRadius: 6,
                color: copied ? 'var(--call)' : 'var(--text-muted)',
                fontSize: 10,
                padding: '5px 10px',
                cursor: 'pointer',
                fontFamily: 'var(--sans)',
                fontWeight: 700,
                transition: 'all 0.2s',
              }}
            >
              {copied ? '✓ Copié' : '📋 Copier'}
            </button>
          </div>
          <pre style={{
            background: 'rgba(255,255,255,.02)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            padding: '12px 14px',
            fontSize: 11,
            fontFamily: 'var(--mono)',
            color: 'var(--text-dim)',
            overflowX: 'auto',
            margin: 0,
            lineHeight: '1.5',
          }}>
            {jsonStr}
          </pre>
        </div>
      )}
    </div>
  )
}
