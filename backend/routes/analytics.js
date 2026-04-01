/**
 * backend/routes/analytics.js
 *
 * Analytics endpoint — aggregates signal history and computes trading statistics.
 *
 * GET /analytics/stats?asset=BTC&days=7
 * Returns: win_rate, avg_gain, avg_loss, sharpe_ratio, max_drawdown, total_signals
 *
 * Results are cached for 5 minutes to avoid costly DB scans on every request.
 */

'use strict'

const express    = require('express')
const router     = express.Router()
const store      = require('../workers/dataStore')
const { SmartCache } = require('../utils/cache')

const SUPPORTED_ASSETS = ['BTC', 'ETH']
const _cache = new SmartCache({ ttlMs: 5 * 60_000 }) // 5-minute TTL

// ── Stats computation ─────────────────────────────────────────────────────────

/**
 * Compute Sharpe ratio from an array of PnL values.
 * Assumes risk-free rate = 0.
 * @param {number[]} pnls
 * @returns {number|null}
 */
function _sharpe(pnls) {
  if (pnls.length < 2) return null
  const mean  = pnls.reduce((a, b) => a + b, 0) / pnls.length
  const variance = pnls.reduce((s, p) => s + (p - mean) ** 2, 0) / (pnls.length - 1)
  const std   = Math.sqrt(variance)
  if (std === 0) return null
  return Math.round((mean / std) * 100) / 100
}

/**
 * Compute max drawdown from an equity curve built from sequential PnL values.
 * @param {number[]} pnls
 * @returns {number|null} max drawdown as a positive percentage
 */
function _maxDrawdown(pnls) {
  if (!pnls.length) return null
  let equity  = 100
  let peak    = 100
  let maxDD   = 0

  for (const pnl of pnls) {
    equity += pnl
    if (equity > peak) peak = equity
    const dd = (peak - equity) / peak * 100
    if (dd > maxDD) maxDD = dd
  }

  return Math.round(maxDD * 100) / 100
}

/**
 * Build stats from a list of signal rows (with non-null pnl).
 */
function _computeStats(rows) {
  const settled = rows.filter(r => r.pnl != null)

  if (!settled.length) {
    return {
      total_signals:  rows.length,
      settled_signals: 0,
      win_rate:       null,
      avg_gain:       null,
      avg_loss:       null,
      sharpe_ratio:   null,
      max_drawdown:   null,
    }
  }

  const pnls   = settled.map(r => Number(r.pnl))
  const wins   = pnls.filter(p => p > 0)
  const losses = pnls.filter(p => p <= 0)

  const winRate  = Math.round((wins.length / settled.length) * 10000) / 100
  const avgGain  = wins.length   ? Math.round(wins.reduce((a, b) => a + b, 0) / wins.length * 10000) / 10000   : null
  const avgLoss  = losses.length ? Math.round(losses.reduce((a, b) => a + b, 0) / losses.length * 10000) / 10000 : null

  return {
    total_signals:   rows.length,
    settled_signals: settled.length,
    win_rate:        winRate,
    avg_gain:        avgGain,
    avg_loss:        avgLoss,
    sharpe_ratio:    _sharpe(pnls),
    max_drawdown:    _maxDrawdown(pnls),
  }
}

// ── Route ─────────────────────────────────────────────────────────────────────

/**
 * GET /analytics/stats?asset=BTC&days=7
 */
router.get('/stats', async (req, res) => {
  const asset = (req.query.asset ?? 'BTC').toUpperCase()
  // Clamp days: minimum 1, maximum 365, default 7
  const rawDays = parseInt(req.query.days ?? '7', 10)
  const days  = Number.isFinite(rawDays) ? Math.min(Math.max(rawDays, 1), 365) : 7

  if (!SUPPORTED_ASSETS.includes(asset)) {
    return res.status(400).json({
      error: `Unsupported asset "${asset}". Supported: ${SUPPORTED_ASSETS.join(', ')}`,
    })
  }

  if (!store.isReady()) {
    return res.status(503).json({ error: 'Database not initialized' })
  }

  const cacheKey = `analytics:${asset}:${days}`
  const cached   = _cache.get(cacheKey)
  if (cached) {
    return res.json({ ...cached, cached: true })
  }

  try {
    const since = Date.now() - days * 24 * 3600 * 1000

    const rows = await store.query(
      'SELECT signal_type, signal_score, trigger_price, outcome, pnl, timestamp FROM signals WHERE asset = ? AND timestamp >= ? ORDER BY timestamp ASC',
      [asset, since],
    )

    const stats = _computeStats(rows)
    const payload = {
      asset,
      days,
      ...stats,
      last_update: new Date().toISOString(),
      cached: false,
    }

    _cache.set(cacheKey, payload)

    res.json(payload)
  } catch (err) {
    console.error(`[analytics] Error computing stats for ${asset}:`, err?.message)
    res.status(500).json({ error: 'Failed to compute analytics', detail: err?.message })
  }
})

module.exports = router
