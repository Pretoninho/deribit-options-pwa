/**
 * CalibrationDebugPanel.jsx
 *
 * Affiche tous les paramètres de calibration actifs, groupés par catégorie.
 * Met en évidence les valeurs surchargées par rapport aux défauts.
 * Auto-refresh toutes les 3s pour suivre les changements de profil en temps réel.
 */

import { useState, useEffect } from 'react'
import {
  getCalibration,
  getActiveCalibrationProfileName,
  DEFAULT_CALIBRATION,
} from '../../signals/signal_calibration.js'

// ── Groupes de paramètres affichés ────────────────────────────────────────────

const GROUPS = [
  {
    label: 'Filtre DVOL',
    keys: ['dvol_calm_max', 'dvol_agitated_min'],
  },
  {
    label: 'Score IV — ratio DVOL/avg30',
    keys: ['iv_ratio_t1', 'iv_ratio_t2', 'iv_ratio_t3', 'iv_ratio_t4'],
    scores: ['→ 25', '→ 50', '→ 75', '→ 100'],
  },
  {
    label: 'Score Funding — % ann.',
    keys: ['funding_t1', 'funding_t2', 'funding_t3', 'funding_t4'],
    scores: ['→ 25', '→ 50', '→ 75', '→ 100'],
  },
  {
    label: 'Score Basis — % ann.',
    keys: ['basis_score_t1', 'basis_score_t2', 'basis_score_t3', 'basis_score_t4'],
    scores: ['→ 25', '→ 50', '→ 75', '→ 100'],
  },
  {
    label: 'Score IV/RV — prime',
    keys: ['ivvsrv_t1', 'ivvsrv_t2', 'ivvsrv_t3'],
    scores: ['→ 50', '→ 75', '→ 100'],
  },
  {
    label: 'Signal global — seuils',
    keys: ['signal_unfav_max', 'signal_neutr_max', 'signal_fav_max'],
    scores: ['neutre', 'favorable', 'exceptionnel'],
  },
  {
    label: 'Détection anomalies',
    keys: ['anomaly_threshold', 'anomaly_window_ms'],
  },
]

// ── CalibrationDebugPanel ─────────────────────────────────────────────────────

export default function CalibrationDebugPanel() {
  const [cal,     setCal]     = useState(() => getCalibration())
  const [profile, setProfile] = useState(() => getActiveCalibrationProfileName())
  const [open,    setOpen]    = useState(false)

  useEffect(() => {
    const id = setInterval(() => {
      setCal(getCalibration())
      setProfile(getActiveCalibrationProfileName())
    }, 3_000)
    return () => clearInterval(id)
  }, [])

  const overrideCount = GROUPS.flatMap(g => g.keys).filter(k => cal[k] !== DEFAULT_CALIBRATION[k]).length

  return (
    <div className="card">
      {/* Header */}
      <div
        className="card-header"
        style={{ cursor: 'pointer', userSelect: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
        onClick={() => setOpen(o => !o)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          Paramètres de calibration actifs
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 10,
            color: 'var(--accent)', fontWeight: 700,
            padding: '1px 7px', borderRadius: 4,
            background: 'var(--accent-dim)', border: '1px solid var(--accent-border)',
          }}>
            {profile}
          </span>
          {overrideCount > 0 && (
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: 10,
              color: 'var(--atm)', fontWeight: 700,
              padding: '1px 7px', borderRadius: 4,
              background: 'rgba(255,215,0,.06)', border: '1px solid rgba(255,215,0,.25)',
            }}>
              {overrideCount} surcharge{overrideCount > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{open ? '▲' : '▼'}</span>
      </div>

      {/* Body */}
      {open && (
        <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {GROUPS.map(group => (
            <div key={group.label}>
              <div style={{
                fontFamily: 'var(--font-body)', fontSize: 9,
                color: 'var(--text-muted)', textTransform: 'uppercase',
                letterSpacing: '0.5px', marginBottom: 7,
              }}>
                {group.label}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {group.keys.map((key, i) => {
                  const val       = cal[key]
                  const def       = DEFAULT_CALIBRATION[key]
                  const overridden = val !== def
                  return (
                    <div key={key} style={{
                      padding: '5px 10px',
                      borderRadius: 7,
                      background: overridden ? 'rgba(255,215,0,.05)' : 'var(--bg-surface-2)',
                      border: `1px solid ${overridden ? 'rgba(255,215,0,.28)' : 'var(--border)'}`,
                      minWidth: 76,
                    }}>
                      <div style={{
                        fontFamily: 'var(--font-body)', fontSize: 9,
                        color: 'var(--text-ghost)', marginBottom: 2, whiteSpace: 'nowrap',
                      }}>
                        {key}{group.scores?.[i] ? <span style={{ color: 'var(--text-muted)', marginLeft: 3 }}>{group.scores[i]}</span> : null}
                      </div>
                      <div style={{
                        fontFamily: 'var(--font-mono)', fontSize: 13,
                        color: overridden ? 'var(--atm)' : 'var(--text)',
                        fontWeight: 700,
                      }}>
                        {val ?? '—'}
                        {overridden && (
                          <span style={{ fontSize: 9, color: 'var(--text-ghost)', fontWeight: 400, marginLeft: 5 }}>
                            / {def}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}

          <div style={{
            fontFamily: 'var(--font-body)', fontSize: 10,
            color: 'var(--text-ghost)', fontStyle: 'italic', paddingTop: 4,
            borderTop: '1px solid var(--border)',
          }}>
            Valeurs en <span style={{ color: 'var(--atm)' }}>jaune</span> = surchargées par rapport au profil équilibré.
            Rafraîchi automatiquement toutes les 3 s.
          </div>
        </div>
      )}
    </div>
  )
}
