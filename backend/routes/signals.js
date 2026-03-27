'use strict'

const express = require('express')
const router  = express.Router()

const { getMarketData } = require('../data/providers')
const { computeSignal } = require('../services/signalEngine')

const SUPPORTED_ASSETS = ['BTC', 'ETH']

/**
 * GET /signals?asset=BTC
 *
 * Returns the computed market signal for the requested asset.
 * Defaults to BTC if no asset is specified.
 */
router.get('/', async (req, res) => {
  const asset = (req.query.asset ?? 'BTC').toUpperCase()

  if (!SUPPORTED_ASSETS.includes(asset)) {
    return res.status(400).json({
      error: `Unsupported asset "${asset}". Supported: ${SUPPORTED_ASSETS.join(', ')}`,
    })
  }

  try {
    const marketData = await getMarketData(asset)
    const signal     = computeSignal({ ...marketData, asset })
    res.json(signal)
  } catch (err) {
    console.error(`[signals] Error computing signal for ${asset}:`, err?.message)
    res.status(502).json({ error: 'Failed to fetch market data', detail: err?.message })
  }
})

module.exports = router
