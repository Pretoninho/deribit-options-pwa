/**
 * backend/routes/analytics.js
 *
 * Analytics endpoint — aggregates signal history and computes trading statistics.
 *
 * GET /analytics/stats?asset=BTC&days=7
 * Returns:
 *   - Legacy: win_rate, avg_gain, avg_loss, sharpe_ratio, max_drawdown, total_signals
 *   - Per-horizon: win_rate_1h/4h/24h, avg_return_1h/4h/24h
 *   - By direction: LONG / SHORT breakdown per horizon
 *   - By vol_source: DVOL / RV breakdown per horizon
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
 * Build legacy stats from a list of signal rows (with non-null pnl).
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

/**
 * Compute per-horizon stats (win_rate, avg_return, total_settled) from joined rows.
 * @param {object[]} rows     - joined signals+outcomes rows
 * @param {'1h'|'4h'|'24h'} h - horizon key
 * @returns {{ win_rate: number|null, avg_return: number|null, total_settled: number }}
 */
function _horizonStats(rows, h) {
  const labelKey  = `label_${h}`
  const returnKey = `move_${h}_pct`

  const settled = rows.filter(r => r[labelKey] != null)
  if (!settled.length) return { win_rate: null, avg_return: null, total_settled: 0 }

  const wins    = settled.filter(r => r[labelKey] === 'WIN')
  const returns = settled.map(r => Number(r[returnKey])).filter(v => !isNaN(v))

  return {
    win_rate:      Math.round((wins.length / settled.length) * 10000) / 100,
    avg_return:    returns.length
      ? Math.round(returns.reduce((a, b) => a + b, 0) / returns.length * 10000) / 10000
      : null,
    total_settled: settled.length,
  }
}

/**
 * Build per-direction breakdown (LONG / SHORT) for all three horizons.
 * @param {object[]} rows
 * @returns {object}
 */
function _directionBreakdown(rows) {
  const result = {}
  for (const dir of ['LONG', 'SHORT']) {
    const subset = rows.filter(r => r.direction === dir)
    result[dir] = {
      total: subset.length,
      '1h': _horizonStats(subset, '1h'),
      '4h': _horizonStats(subset, '4h'),
      '24h': _horizonStats(subset, '24h'),
    }
  }
  return result
}

/**
 * Build per-vol_source breakdown (DVOL / RV) for all three horizons.
 * @param {object[]} rows
 * @returns {object}
 */
function _volSourceBreakdown(rows) {
  const result = {}
  for (const src of ['DVOL', 'RV']) {
    const subset = rows.filter(r => r.vol_source === src)
    result[src] = {
      total: subset.length,
      '1h': _horizonStats(subset, '1h'),
      '4h': _horizonStats(subset, '4h'),
      '24h': _horizonStats(subset, '24h'),
    }
  }
  return result
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

    // Join signals with outcomes to get per-horizon labels and returns
    const rows = await store.query(
      `SELECT s.signal_type, s.signal_score, s.trigger_price, s.outcome, s.pnl,
              s.timestamp, s.direction, s.vol_source,
              o.label_1h,  o.label_4h,  o.label_24h,
              o.move_1h_pct, o.move_4h_pct, o.move_24h_pct
       FROM signals s
       LEFT JOIN outcomes o ON o.signal_id = s.id
       WHERE s.asset = ? AND s.timestamp >= ?
       ORDER BY s.timestamp ASC`,
      [asset, since],
    )

    // Legacy stats (pnl-based)
    const legacyStats = _computeStats(rows)

    // Directional signals only (direction != null) for horizon stats
    const directional = rows.filter(r => r.direction != null)

    const payload = {
      asset,
      days,
      ...legacyStats,

      // Per-horizon win rates and avg returns (directional signals only)
      win_rate_1h:    _horizonStats(directional, '1h').win_rate,
      win_rate_4h:    _horizonStats(directional, '4h').win_rate,
      win_rate_24h:   _horizonStats(directional, '24h').win_rate,
      avg_return_1h:  _horizonStats(directional, '1h').avg_return,
      avg_return_4h:  _horizonStats(directional, '4h').avg_return,
      avg_return_24h: _horizonStats(directional, '24h').avg_return,
      settled_1h:     _horizonStats(directional, '1h').total_settled,
      settled_4h:     _horizonStats(directional, '4h').total_settled,
      settled_24h:    _horizonStats(directional, '24h').total_settled,

      // Breakdown by direction (LONG / SHORT)
      by_direction: _directionBreakdown(directional),

      // Breakdown by vol source (DVOL / RV)
      by_vol_source: _volSourceBreakdown(directional),

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

