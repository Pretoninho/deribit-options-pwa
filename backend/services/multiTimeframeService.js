'use strict'

function detectRegime4h(signal4h) {
  const scoreGlobal4h = signal4h?.global ?? null
  const dvolFactor = signal4h?.dvolFactor ?? 1

  const isCompressionMode = dvolFactor < 0.8 && scoreGlobal4h != null && scoreGlobal4h < 50
  const isExcessMode = dvolFactor > 1.0 && scoreGlobal4h != null && scoreGlobal4h > 60

  const regimeType = isCompressionMode
    ? 'BREAKOUT'
    : isExcessMode
    ? 'MEAN_REVERSION'
    : 'NEUTRAL'

  const confidence = scoreGlobal4h != null ? Math.abs(scoreGlobal4h - 50) / 50 : 0

  return {
    type: regimeType,
    confidence,
    isCompatible: (setup1h) => {
      if (regimeType === 'BREAKOUT') return setup1h.type === 'COMPRESSION'
      if (regimeType === 'MEAN_REVERSION') return setup1h.type === 'SPIKE'
      return true
    },
  }
}

function detectSetup1h(signal1h) {
  const score1h = signal1h?.global ?? null
  const dvolFactor = signal1h?.dvolFactor ?? 1

  const isCompression = dvolFactor < 0.9 && score1h != null && score1h < 55
  const isSpike = dvolFactor > 1.1 || (score1h != null && score1h > 65)

  const setupType = isSpike ? 'SPIKE' : isCompression ? 'COMPRESSION' : 'NEUTRAL'
  const confidence = score1h != null ? Math.abs(score1h - 50) / 50 : 0

  return {
    type: setupType,
    confidence,
    timestamp: Date.now(),
    isCompatible: (entry5min) => {
      if (setupType === 'COMPRESSION') return entry5min.signal === 'BREAKOUT'
      if (setupType === 'SPIKE') return entry5min.signal === 'REJECTION'
      return true
    },
  }
}

function detectEntry5min(signal5min) {
  const score5min = signal5min?.global ?? null

  let entrySignal = 'WAIT'
  if (score5min != null) {
    if (score5min > 60) entrySignal = 'BREAKOUT'
    else if (score5min < 40) entrySignal = 'REJECTION'
  }

  const action = (score5min != null && (score5min > 65 || score5min < 35)) ? 'EXECUTE' : 'WAIT'
  const confidence = score5min != null ? Math.abs(score5min - 50) / 50 : 0

  return {
    signal: entrySignal,
    confidence,
    action,
  }
}

function computeMultiTimeframeFromSignal(signalResult) {
  const global = signalResult?.global ?? null
  const dvolFactor = signalResult?.dvolFactor ?? 1

  const signal4h = {
    ...signalResult,
    global: global != null ? Math.max(0, Math.min(100, global - 5)) : null,
    dvolFactor,
  }

  const signal1h = {
    ...signalResult,
    global: global != null ? Math.max(0, Math.min(100, global + 8)) : null,
    dvolFactor: dvolFactor * 1.05,
  }

  const signal5min = {
    ...signalResult,
    global: global != null ? Math.max(0, Math.min(100, global + 12)) : null,
    dvolFactor: dvolFactor * 1.15,
  }

  const regime4h = detectRegime4h(signal4h)
  const setup1h = detectSetup1h(signal1h)
  const entry5min = detectEntry5min(signal5min)

  const htf_mtf = regime4h.isCompatible(setup1h)
  const mtf_ltf = setup1h.isCompatible(entry5min)

  return {
    regime_4h: regime4h,
    setup_1h: setup1h,
    entry_5min: entry5min,
    alignment: {
      htf_mtf,
      mtf_ltf,
      all_aligned: htf_mtf && mtf_ltf,
    },
  }
}

function buildSignalPayload(asset, signal, { cached = false } = {}) {
  return {
    asset,
    ...signal,
    cached,
    multi_timeframe: computeMultiTimeframeFromSignal(signal),
  }
}

module.exports = {
  buildSignalPayload,
}
