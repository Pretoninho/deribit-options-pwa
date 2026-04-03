/**
 * insight_generator.js — Générateur d'insights via Claude API
 *
 * Génère des insights textuels pour les métriques de marché en utilisant l'API Claude.
 * Optimisations :
 *   - TTL par métrique (iv_rank plus volatile que hash_rate)
 *   - Arrondi ±0.5 des scores pour réduire les appels API redondants
 *   - Cache FIFO borné à 500 entrées (évite les fuites mémoire)
 *
 * Usage :
 *   const insight = await generateInsight('iv_rank', 72.5)
 *   // null si l'API key n'est pas configurée
 */

import { API_CONFIG } from '../config/signal_calibration.js'

// ── TTL par métrique ──────────────────────────────────────────────────────────

/** TTL en ms selon la volatilité de chaque métrique. */
const METRIC_TTL = {
  'iv_rank':   1 * 60 * 1000,  // 1 min — très volatile
  'funding':   2 * 60 * 1000,  // 2 min — modérément volatile
  'hash_rate': 5 * 60 * 1000,  // 5 min — métrique on-chain stable
  'basis':     2 * 60 * 1000,  // 2 min
  'rv':        3 * 60 * 1000,  // 3 min
  'default':   3 * 60 * 1000,  // fallback
}

/**
 * Retourne le TTL pour une métrique donnée.
 * @param {string} metric
 * @returns {number} TTL en ms
 */
function _getTTL(metric) {
  return METRIC_TTL[metric] ?? METRIC_TTL['default']
}

// ── Cache FIFO borné ──────────────────────────────────────────────────────────

const CACHE_MAX_SIZE = 500

/** @type {Map<string, { value: string, expiresAt: number }>} */
const _cache = new Map()

/**
 * Stocke une entrée dans le cache avec éviction FIFO si la taille max est atteinte.
 * @param {string} key
 * @param {string} value
 * @param {string} metric
 */
function _setCacheEntry(key, value, metric) {
  if (_cache.size >= CACHE_MAX_SIZE) {
    // Éviction FIFO — supprime l'entrée la plus ancienne (garantie par l'ordre d'insertion Map)
    const firstKey = _cache.keys().next().value
    _cache.delete(firstKey)
  }
  _cache.set(key, { value, expiresAt: Date.now() + _getTTL(metric) })
}

/**
 * Récupère une entrée du cache si elle n'est pas expirée.
 * @param {string} key
 * @returns {string|null}
 */
function _getCacheEntry(key) {
  const entry = _cache.get(key)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) {
    _cache.delete(key)
    return null
  }
  return entry.value
}

// ── Génération d'insight ──────────────────────────────────────────────────────

/**
 * Génère un insight textuel pour une métrique et un score donnés via Claude API.
 * Utilise un cache FIFO avec TTL par métrique et arrondi ±0.5 pour limiter les appels.
 *
 * @param {string} metric   — ex: 'iv_rank', 'funding', 'hash_rate'
 * @param {number} score    — score brut (0–100)
 * @param {object} [context] — contexte additionnel optionnel
 * @returns {Promise<string|null>} insight ou null si non disponible
 */
export async function generateInsight(metric, score, context = {}) {
  // NOTE: VITE_ANTHROPIC_API_KEY is a public env var prefixed with VITE_.
  // Do NOT use a secret/production API key here — only public/limited-quota keys.
  const apiKey = import.meta.env?.VITE_ANTHROPIC_API_KEY
  if (!apiKey) return null

  // Arrondi au ±0.5 le plus proche — regroupe les scores proches et réduit les appels API
  // Ex: 82.05 → 82.0, 82.4 → 82.5
  const roundedScore = Math.round(score * 2) / 2
  const cacheKey = `${metric}:${roundedScore}`

  const cached = _getCacheEntry(cacheKey)
  if (cached !== null) return cached

  try {
    const prompt = _buildPrompt(metric, roundedScore, context)
    const response = await fetch(API_CONFIG.ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      API_CONFIG.CLAUDE_MODEL,
        max_tokens: API_CONFIG.CLAUDE_MAX_TOKENS,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!response.ok) {
      console.warn(`[insight_generator] API error ${response.status} for ${cacheKey}`)
      return null
    }

    const data = await response.json()
    const insight = data?.content?.[0]?.text?.trim() ?? null
    if (insight) {
      _setCacheEntry(cacheKey, insight, metric)
    }
    return insight
  } catch (err) {
    if (err?.name !== 'AbortError') {
      console.warn('[insight_generator] Fetch failed:', err?.message)
    }
    return null
  }
}

/**
 * Construit le prompt Claude pour une métrique et un score.
 * @param {string} metric
 * @param {number} score
 * @param {object} context
 * @returns {string}
 */
function _buildPrompt(metric, score, context) {
  const asset = context.asset ?? 'BTC'
  const metricLabels = {
    'iv_rank':   'IV Rank (rang de volatilité implicite)',
    'funding':   'Funding Rate (taux de financement)',
    'hash_rate': 'Hash Rate (taux de hachage réseau)',
    'basis':     'Basis (base futures/spot)',
    'rv':        'Realized Volatility (volatilité réalisée)',
  }
  const label = metricLabels[metric] ?? metric
  return `${asset} ${label} = ${score}/100. En 1 phrase courte, explique l'implication pour un trader d'options crypto.`
}

/**
 * Retourne la taille actuelle du cache d'insights (pour debug/monitoring).
 * @returns {number}
 */
export function getInsightCacheSize() {
  return _cache.size
}

/**
 * Vide le cache d'insights (utile pour les tests).
 */
export function clearInsightCache() {
  _cache.clear()
}
