/**
 * signals/economic_calendar.js
 *
 * Récupère le calendrier des annonces macro "High" importance
 * depuis l'API TradingEconomics.
 *
 * API key : variable d'environnement VITE_TE_API_KEY
 *           (fallback : "guest:guest" — limité, OK pour tests)
 *
 * Docs : https://docs.tradingeconomics.com/#calendar
 *
 * Cache localStorage : 1 heure (CACHE_TTL)
 * En cas d'erreur réseau, retourne le cache précédent ou []
 */

const TE_BASE_URL = 'https://api.tradingeconomics.com'
const CACHE_KEY   = 84ab6a198c374ee:j0mgn1w2o9q0mcv
const CACHE_TTL   = 60 * 60 * 1_000  // 1 heure
const TIMEOUT_MS  = 10_000

// ── Helpers ───────────────────────────────────────────────────────────────────

function _apiKey() {
  return (typeof import.meta !== 'undefined' && import.meta.env?.VITE_TE_API_KEY) || 'guest:guest'
}

/**
 * Normalise un événement TradingEconomics au format interne.
 * Les dates TE sont exprimées en UTC sans suffixe → on ajoute 'Z'.
 *
 * @param {object} ev
 * @returns {{ ts: number|null, date: string, country: string, currency: string,
 *             event: string, importance: number, actual: string|null,
 *             previous: string|null, forecast: string|null }}
 */
function _normalize(ev) {
  const rawDate = ev.Date ?? ev.date ?? null
  const ts      = rawDate ? new Date(rawDate.endsWith('Z') ? rawDate : rawDate + 'Z').getTime() : null
  return {
    ts,
    date:       rawDate ?? '',
    country:    ev.Country    ?? ev.country    ?? '?',
    currency:   ev.Currency   ?? ev.currency   ?? '?',
    event:      ev.Event      ?? ev.event      ?? ev.Category ?? '?',
    importance: ev.Importance ?? ev.importance ?? 1,
    actual:     ev.Actual     != null ? String(ev.Actual)   : null,
    previous:   ev.Previous   != null ? String(ev.Previous) : null,
    forecast:   ev.Forecast   != null ? String(ev.Forecast) : null,
  }
}

// ── Cache localStorage ────────────────────────────────────────────────────────

/**
 * Retourne les événements mis en cache + timestamp de mise à jour.
 * @returns {{ events: Array, cachedAt: number|null }}
 */
export function getCachedEconomicEvents() {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return { events: [], cachedAt: null }
    const cached = JSON.parse(raw)
    return { events: cached.events ?? [], cachedAt: cached.cachedAt ?? null }
  } catch (_) {
    return { events: [], cachedAt: null }
  }
}

/**
 * Persiste les événements dans localStorage avec timestamp.
 * @param {Array} events
 */
export function cacheEconomicEvents(events) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ events, cachedAt: Date.now() }))
  } catch (_) {}
}

// ── Fetch ─────────────────────────────────────────────────────────────────────

/**
 * Interroge l'API TradingEconomics pour obtenir le calendrier de la semaine.
 * Filtre uniquement les événements High importance (importance >= 3).
 * Retourne [] silencieusement en cas d'erreur.
 *
 * @returns {Promise<Array>}
 */
export async function fetchEconomicCalendar() {
  const key  = _apiKey()
  const url  = `${TE_BASE_URL}/calendar?c=${encodeURIComponent(key)}`
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)

  try {
    const res = await fetch(url, { signal: ctrl.signal })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    if (!Array.isArray(data)) return []

    return data
      .map(_normalize)
      .filter(ev => ev.importance >= 3 && ev.ts != null)
      .sort((a, b) => a.ts - b.ts)
  } catch (err) {
    console.warn('[EconomicCalendar] fetch failed:', err.message)
    return []
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Retourne les événements du cache s'ils sont frais (< CACHE_TTL),
 * sinon fetch depuis l'API et met à jour le cache.
 *
 * @returns {Promise<Array>}
 */
export async function getEconomicEvents() {
  const { events, cachedAt } = getCachedEconomicEvents()
  if (cachedAt != null && Date.now() - cachedAt < CACHE_TTL && events.length > 0) {
    return events
  }
  const fresh = await fetchEconomicCalendar()
  // Conserver l'ancien cache si la requête a retourné [] (erreur réseau)
  if (fresh.length > 0) cacheEconomicEvents(fresh)
  return fresh.length > 0 ? fresh : events
}
