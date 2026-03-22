/**
 * providers/onchain.js — Données on-chain Bitcoin/Ethereum
 *
 * Sources publiques gratuites, sans clé API :
 *   1. Blockchain.info  — statistiques réseau BTC
 *   2. Mempool.space    — mempool + fees recommandés
 *   3. Glassnode public — exchange flows (net)
 *   4. CryptoQuant      — netflow BTC exchanges
 *
 * Chaque fonction retourne null en cas d'erreur.
 * Promise.allSettled est utilisé pour que les autres sources continuent
 * même si l'une est hors ligne.
 */

const TIMEOUT_MS = 5_000

/**
 * Fetch avec timeout.
 * @param {string} url
 * @param {number} [ms]
 */
async function fetchWithTimeout(url, ms = TIMEOUT_MS) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), ms)
  try {
    const res = await fetch(url, { signal: ctrl.signal })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } finally {
    clearTimeout(timer)
  }
}

// ── Source 1 : Blockchain.info ────────────────────────────────────────────────

/**
 * Statistiques réseau Bitcoin depuis blockchain.info.
 * @returns {Promise<{
 *   n_tx: number,
 *   total_fees_btc: number,
 *   mempool_size: number,
 *   hash_rate: number,
 *   difficulty: number,
 *   timestamp: number
 * }|null>}
 */
export async function getBlockchainStats() {
  try {
    const data = await fetchWithTimeout('https://blockchain.info/stats?format=json')
    return {
      n_tx:           data.n_tx           ?? null,
      total_fees_btc: data.total_fees_btc ?? null,
      mempool_size:   data.mempool_size   ?? null,
      hash_rate:      data.hash_rate      ?? null,
      difficulty:     data.difficulty     ?? null,
      timestamp:      Date.now(),
    }
  } catch {
    return null
  }
}

// ── Source 2 : Mempool.space ──────────────────────────────────────────────────

/**
 * État du mempool Bitcoin depuis mempool.space.
 * @returns {Promise<{
 *   count: number,
 *   vsize: number,
 *   total_fee: number,
 *   fastestFee: number,
 *   halfHourFee: number,
 *   hourFee: number,
 *   minimumFee: number,
 *   timestamp: number
 * }|null>}
 */
export async function getMempoolData() {
  try {
    const [mempool, fees] = await Promise.allSettled([
      fetchWithTimeout('https://mempool.space/api/mempool'),
      fetchWithTimeout('https://mempool.space/api/v1/fees/recommended'),
    ])

    const m = mempool.status === 'fulfilled' ? mempool.value : {}
    const f = fees.status    === 'fulfilled' ? fees.value    : {}

    return {
      count:       m.count       ?? null,
      vsize:       m.vsize       ?? null,
      total_fee:   m.total_fee   ?? null,
      fastestFee:  f.fastestFee  ?? null,
      halfHourFee: f.halfHourFee ?? null,
      hourFee:     f.hourFee     ?? null,
      minimumFee:  f.minimumFee  ?? null,
      timestamp:   Date.now(),
    }
  } catch {
    return null
  }
}

// ── Source 3 : Glassnode public ───────────────────────────────────────────────

/**
 * Exchange net flow depuis Glassnode (endpoint public limité).
 * @param {'BTC'|'ETH'} [asset]
 * @returns {Promise<{ netflow: number|null, asset: string, timestamp: number }|null>}
 */
export async function getGlassnodeExchangeFlow(asset = 'BTC') {
  try {
    const url = `https://api.glassnode.com/v1/metrics/transactions/transfers_volume_exchanges_net?a=${asset}&api_key=anonymous`
    const data = await fetchWithTimeout(url)

    // Glassnode retourne un array [{t, v}], on prend la dernière valeur
    const latest = Array.isArray(data) ? data[data.length - 1] : null
    return {
      netflow:   latest?.v   ?? null,
      asset:     asset.toUpperCase(),
      timestamp: latest?.t ? latest.t * 1000 : Date.now(),
    }
  } catch {
    return null
  }
}

// ── Source 4 : CryptoQuant public ────────────────────────────────────────────

/**
 * Exchange netflow BTC depuis CryptoQuant.
 * @returns {Promise<{
 *   inflow: number|null,
 *   outflow: number|null,
 *   netflow: number|null,
 *   timestamp: number
 * }|null>}
 */
export async function getCryptoQuantFlow() {
  try {
    const url = 'https://api.cryptoquant.com/v1/btc/exchange-flows/netflow?window=day&limit=1'
    const data = await fetchWithTimeout(url)

    // CryptoQuant : { data: { result: [{ inflow_total, outflow_total, netflow_total, ... }] } }
    const row = data?.data?.result?.[0]
    return {
      inflow:    row?.inflow_total  ?? null,
      outflow:   row?.outflow_total ?? null,
      netflow:   row?.netflow_total ?? null,
      timestamp: Date.now(),
    }
  } catch {
    return null
  }
}

// ── Snapshot combiné ──────────────────────────────────────────────────────────

/**
 * Récupère toutes les données on-chain en parallèle.
 * Une source hors ligne ne bloque pas les autres.
 * @param {'BTC'|'ETH'} [asset]
 * @returns {Promise<{ blockchain, mempool, glassnodeFlow, cryptoQuantFlow }>}
 */
export async function getOnChainSnapshot(asset = 'BTC') {
  const [blockchain, mempool, glassnodeFlow, cryptoQuantFlow] = await Promise.allSettled([
    getBlockchainStats(),
    getMempoolData(),
    getGlassnodeExchangeFlow(asset),
    getCryptoQuantFlow(),
  ])

  return {
    blockchain:     blockchain.status     === 'fulfilled' ? blockchain.value     : null,
    mempool:        mempool.status        === 'fulfilled' ? mempool.value        : null,
    glassnodeFlow:  glassnodeFlow.status  === 'fulfilled' ? glassnodeFlow.value  : null,
    cryptoQuantFlow: cryptoQuantFlow.status === 'fulfilled' ? cryptoQuantFlow.value : null,
  }
}
