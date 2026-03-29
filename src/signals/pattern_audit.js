/**
 * signals/pattern_audit.js
 *
 * Journal d'audit des détections de patterns de marché.
 * Chaque appel à recordPattern déclenche une entrée pour traçabilité debug.
 *
 * Stockage : localStorage (clé 'veridex_pattern_audit')
 * Limite   : MAX_AUDIT_ENTRIES entrées (FIFO)
 */

const AUDIT_KEY        = 'veridex_pattern_audit'
const MAX_AUDIT_ENTRIES = 100

// ── Helpers internes ──────────────────────────────────────────────────────────

function _load() {
  try {
    return JSON.parse(localStorage.getItem(AUDIT_KEY) || '[]')
  } catch (_) {
    return []
  }
}

// ── API publique ──────────────────────────────────────────────────────────────

/**
 * Sauvegarde une entrée d'audit lors d'une détection de pattern.
 *
 * @param {{
 *   asset:       string,
 *   hash:        string,
 *   config:      object,
 *   inputs:      { ivRank: number|null, fundingAnn: number|null, lsRatio: number|null, basisPct: number|null },
 *   spot:        number,
 *   occurrences: number,
 * }} entry
 */
export function savePatternAuditEntry(entry) {
  try {
    const log = _load()
    log.push({ ...entry, ts: Date.now() })
    if (log.length > MAX_AUDIT_ENTRIES) log.splice(0, log.length - MAX_AUDIT_ENTRIES)
    localStorage.setItem(AUDIT_KEY, JSON.stringify(log))
  } catch (_) {}
}

/**
 * Retourne le journal d'audit (du plus récent au plus ancien).
 * @param {number} [limit=50]
 * @returns {Array}
 */
export function getPatternAuditLog(limit = 50) {
  const log = _load()
  return log.slice(-limit).reverse()
}

/**
 * Efface le journal d'audit.
 */
export function clearPatternAuditLog() {
  localStorage.removeItem(AUDIT_KEY)
}
