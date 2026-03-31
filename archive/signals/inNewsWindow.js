/**
 * signals/inNewsWindow.js
 *
 * Vérifie si un timestamp se trouve dans la fenêtre T−30min / T+30min
 * d'une annonce macro "High" importance.
 *
 * Fonction pure — aucune dépendance externe.
 */

/** Demi-largeur de la fenêtre (ms). */
export const NEWS_WINDOW_MS = 30 * 60 * 1_000  // 30 minutes

/**
 * Détermine si un timestamp est dans la fenêtre d'une annonce macro.
 *
 * @param {number} ts — timestamp à tester (ms depuis epoch)
 * @param {Array<{ ts: number, event: string, currency: string }>} events
 *   Liste d'annonces (déjà filtrées High importance)
 * @returns {{
 *   inWindow:     boolean,
 *   nearestEvent: { ts: number, event: string, currency: string }|null,
 *   minutesAway:  number|null,
 *   isPre:        boolean,   — true si l'annonce est à venir
 *   isPost:       boolean,   — true si l'annonce est passée
 * }}
 */
export function isInNewsWindow(ts, events = []) {
  if (!events.length) {
    return { inWindow: false, nearestEvent: null, minutesAway: null, isPre: false, isPost: false }
  }

  let nearest = null
  let minDiff = Infinity

  for (const ev of events) {
    if (ev.ts == null) continue
    const diff = Math.abs(ts - ev.ts)
    if (diff < minDiff) {
      minDiff = diff
      nearest = ev
    }
  }

  if (nearest == null) {
    return { inWindow: false, nearestEvent: null, minutesAway: null, isPre: false, isPost: false }
  }

  const inWindow   = minDiff <= NEWS_WINDOW_MS
  const minutesAway = Math.round(minDiff / 60_000)
  const isPre      = inWindow && nearest.ts > ts
  const isPost     = inWindow && nearest.ts <= ts

  return {
    inWindow,
    nearestEvent: inWindow ? nearest : null,
    minutesAway,
    isPre,
    isPost,
  }
}
