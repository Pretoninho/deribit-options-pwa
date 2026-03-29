/**
 * ExportDetectedPatternsButton.jsx
 *
 * Exporte tous les patterns IndexedDB + la calibration active en JSON.
 * Téléchargement côté client, zero serveur.
 *
 * Le fichier généré contient :
 *   - exportedAt  : date ISO
 *   - profile     : nom du profil actif
 *   - calibration : tous les paramètres actifs
 *   - patternCount: nombre de patterns
 *   - patterns    : tableau complet (hash, config, occurrences, winRates, patternStats…)
 */

import { useState } from 'react'
import { getAllPatterns }                          from '../../signals/market_fingerprint.js'
import { getCalibration, getActiveCalibrationProfileName } from '../../signals/signal_calibration.js'

export default function ExportDetectedPatternsButton({ style }) {
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)

  async function handleExport() {
    setLoading(true)
    setError(null)
    try {
      const patterns = await getAllPatterns()

      const payload = {
        exportedAt:   new Date().toISOString(),
        profile:      getActiveCalibrationProfileName(),
        calibration:  getCalibration(),
        patternCount: patterns.length,
        patterns,
      }

      const blob = new Blob(
        [JSON.stringify(payload, null, 2)],
        { type: 'application/json' }
      )
      const url = URL.createObjectURL(blob)
      const a   = document.createElement('a')
      a.href     = url
      a.download = `veridex_patterns_${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('[ExportPatterns]', err)
      setError('Erreur lors de l\'export')
    }
    setLoading(false)
  }

  return (
    <div style={style}>
      <button
        onClick={handleExport}
        disabled={loading}
        style={{
          display:     'flex',
          alignItems:  'center',
          gap:         7,
          padding:     '7px 14px',
          background:  'transparent',
          border:      '1px solid var(--border)',
          borderRadius: 8,
          color:       loading ? 'var(--text-ghost)' : 'var(--text-dim)',
          fontFamily:  'var(--font-body)',
          fontSize:    11,
          fontWeight:  600,
          cursor:      loading ? 'default' : 'pointer',
          transition:  'border-color 120ms, color 120ms',
          whiteSpace:  'nowrap',
        }}
      >
        <span style={{ fontSize: 13 }}>{loading ? '…' : '⬇'}</span>
        Exporter les patterns
      </button>
      {error && (
        <div style={{ marginTop: 4, fontSize: 10, color: 'var(--put)', fontFamily: 'var(--font-body)' }}>
          {error}
        </div>
      )}
    </div>
  )
}
