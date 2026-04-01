/**
 * backend/workers/dataCollector.js
 *
 * Continuous data collection worker.
 * Polls Deribit every 60 seconds for BTC and ETH market data,
 * persists tickers and signals to the database.
 */

'use strict'

const { fetchAllData }  = require('../data_core/index')
const { computeSignal } = require('../services/signalEngine')
const store             = require('./dataStore')

const ASSETS           = ['BTC', 'ETH']
const POLL_INTERVAL_MS = 60_000 // 1 minute

// ── Collector state ───────────────────────────────────────────────────────────

let _intervalId  = null
let _isRunning   = false
let _lastPollAt  = null
let _errorCount  = 0
let _pollCount   = 0

// ── Helpers ───────────────────────────────────────────────────────────────────

function _ts() {
  return new Date().toISOString()
}

/**
 * Map signal global score to a label bucket (HIGH / MEDIUM / LOW / NEUTRAL).
 * @param {number|null} score
 * @returns {string}
 */
function _signalType(score) {
  if (score == null) return 'NEUTRAL'
  if (score >= 80)   return 'HIGH'
  if (score >= 60)   return 'MEDIUM'
  if (score >= 40)   return 'LOW'
  return 'NEUTRAL'
}

// ── Core poll ─────────────────────────────────────────────────────────────────

/**
 * Collect data for a single asset and persist to the database.
 * @param {'BTC'|'ETH'} asset
 */
async function _collectAsset(asset) {
  const data   = await fetchAllData(asset)
  const signal = computeSignal({ ...data, asset })

  const now = Date.now()

  // ── Persist ticker ────────────────────────────────────────────────────────

  const ivRank = (() => {
    if (!data.dvol) return null
    const { current, monthMin, monthMax } = data.dvol
    if (monthMax <= monthMin) return null
    return ((current - monthMin) / (monthMax - monthMin)) * 100
  })()

  await store.insert('tickers', {
    asset,
    timestamp: now,
    spot:      data.spot,
    iv_rank:   ivRank != null ? Math.round(ivRank * 100) / 100 : null,
    funding:   data.funding?.rateAnn ?? null,
  // oi: fetchAllData() does not fetch OI; extend via deribit.getOpenInterest() if needed
    oi:        null,
    skew:      null,
  })

  // ── Persist signal ────────────────────────────────────────────────────────

  await store.insert('signals', {
    asset,
    timestamp:    now,
    signal_type:  _signalType(signal.global),
    trigger_price: data.spot,
    signal_score: signal.global,
    components:   JSON.stringify({
      s1: signal.scores?.s1,
      s2: signal.scores?.s2,
      s3: signal.scores?.s3,
      s4: signal.scores?.s4,
      s5: signal.scores?.s5,
      s6: signal.scores?.s6,
    }),
  })
}

/**
 * Run one full poll cycle across all assets.
 */
async function _poll() {
  const start = Date.now()
  console.log(`[dataCollector] ${_ts()} — Polling ${ASSETS.join(', ')}…`)

  const results = await Promise.allSettled(ASSETS.map(_collectAsset))

  results.forEach((r, i) => {
    if (r.status === 'rejected') {
      _errorCount++
      console.error(`[dataCollector] ${_ts()} — Error collecting ${ASSETS[i]}:`, r.reason?.message)
    }
  })

  _lastPollAt = Date.now()
  _pollCount++

  const elapsed = Date.now() - start
  console.log(`[dataCollector] ${_ts()} — Poll #${_pollCount} done in ${elapsed}ms`)
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Start the data collector.
 * Runs an immediate first poll then repeats every POLL_INTERVAL_MS.
 */
function startDataCollector() {
  if (_isRunning) {
    console.warn('[dataCollector] Already running — ignoring duplicate start')
    return
  }

  if (!store.isReady()) {
    console.error('[dataCollector] Database not initialized — call initDatabase() first')
    return
  }

  _isRunning = true
  console.log(`[dataCollector] Starting — polling every ${POLL_INTERVAL_MS / 1000}s`)

  // Fire immediately, then schedule
  _poll().catch(err => console.error('[dataCollector] Initial poll error:', err?.message))

  _intervalId = setInterval(() => {
    _poll().catch(err => console.error('[dataCollector] Poll error:', err?.message))
  }, POLL_INTERVAL_MS)
}

/**
 * Stop the data collector gracefully.
 */
function stopDataCollector() {
  if (_intervalId) {
    clearInterval(_intervalId)
    _intervalId = null
  }
  _isRunning = false
  console.log('[dataCollector] Stopped')
}

/**
 * Return current collector status (for health endpoint).
 */
function getCollectorStatus() {
  return {
    running:    _isRunning,
    lastPollAt: _lastPollAt,
    pollCount:  _pollCount,
    errorCount: _errorCount,
    intervalMs: POLL_INTERVAL_MS,
  }
}

module.exports = { startDataCollector, stopDataCollector, getCollectorStatus }
