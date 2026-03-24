import { describe, it, expect } from 'vitest'
import { classifyMove, computeAdvancedStats, TIMEFRAMES } from './market_fingerprint.js'

// ── TIMEFRAMES ────────────────────────────────────────────────────────────────

describe('TIMEFRAMES', () => {
  it('contient exactement 1h, 24h et 7d', () => {
    expect(TIMEFRAMES).toEqual(['1h', '24h', '7d'])
  })
})

// ── classifyMove ──────────────────────────────────────────────────────────────

describe('classifyMove', () => {
  it('bigDown si move < -3', () => {
    expect(classifyMove(-5)).toBe('bigDown')
    expect(classifyMove(-3.01)).toBe('bigDown')
  })

  it('down si -3 ≤ move < -0.1', () => {
    expect(classifyMove(-3)).toBe('down')
    expect(classifyMove(-1)).toBe('down')
    expect(classifyMove(-0.11)).toBe('down')
  })

  it('flat si -0.1 ≤ move ≤ 0.1', () => {
    expect(classifyMove(0)).toBe('flat')
    expect(classifyMove(0.1)).toBe('flat')
    expect(classifyMove(-0.1)).toBe('flat')
  })

  it('up si 0.1 < move ≤ 3', () => {
    expect(classifyMove(0.11)).toBe('up')
    expect(classifyMove(1)).toBe('up')
    expect(classifyMove(3)).toBe('up')
  })

  it('bigUp si move > 3', () => {
    expect(classifyMove(3.01)).toBe('bigUp')
    expect(classifyMove(10)).toBe('bigUp')
  })
})

// ── computeAdvancedStats ──────────────────────────────────────────────────────

describe('computeAdvancedStats', () => {
  it('retourne null si stat est null ou occurrences = 0', () => {
    expect(computeAdvancedStats(null)).toBeNull()
    expect(computeAdvancedStats(undefined)).toBeNull()
    expect(computeAdvancedStats({ occurrences: 0 })).toBeNull()
  })

  it('calcule correctement probUp et probDown', () => {
    const stat = {
      occurrences: 10,
      upMoves:     6,
      downMoves:   3,
      flatMoves:   1,
      avgUpMove:   2,
      avgDownMove: -1,
      distribution: { bigDown: 0, down: 3, flat: 1, up: 4, bigUp: 2 },
    }
    const result = computeAdvancedStats(stat)
    expect(result.probUp).toBe(0.6)
    expect(result.probDown).toBe(0.3)
  })

  it('calcule correctement expectedValue', () => {
    const stat = {
      occurrences: 10,
      upMoves:     6,
      downMoves:   3,
      flatMoves:   1,
      avgUpMove:   2,
      avgDownMove: -1,
      distribution: { bigDown: 0, down: 3, flat: 1, up: 4, bigUp: 2 },
    }
    // probUp * avgUpMove + probDown * avgDownMove = 0.6*2 + 0.3*(-1) = 1.2 - 0.3 = 0.9
    const result = computeAdvancedStats(stat)
    expect(result.expectedValue).toBe(0.9)
  })

  it('calcule correctement riskReward', () => {
    const stat = {
      occurrences: 10,
      upMoves:     6,
      downMoves:   3,
      flatMoves:   1,
      avgUpMove:   4,
      avgDownMove: -2,
      distribution: { bigDown: 0, down: 3, flat: 1, up: 4, bigUp: 2 },
    }
    // riskReward = |avgUpMove / avgDownMove| = 4/2 = 2
    const result = computeAdvancedStats(stat)
    expect(result.riskReward).toBe(2)
  })

  it('retourne riskReward null si avgDownMove = 0', () => {
    const stat = {
      occurrences: 5,
      upMoves:     5,
      downMoves:   0,
      flatMoves:   0,
      avgUpMove:   3,
      avgDownMove: 0,
      distribution: { bigDown: 0, down: 0, flat: 0, up: 3, bigUp: 2 },
    }
    const result = computeAdvancedStats(stat)
    expect(result.riskReward).toBeNull()
  })

  it('expose la distribution inchangée', () => {
    const dist = { bigDown: 1, down: 2, flat: 1, up: 3, bigUp: 2 }
    const stat = {
      occurrences: 9,
      upMoves:     5,
      downMoves:   3,
      flatMoves:   1,
      avgUpMove:   1.5,
      avgDownMove: -1,
      distribution: dist,
    }
    const result = computeAdvancedStats(stat)
    expect(result.distribution).toBe(dist)
  })

  it('arrondit probUp et probDown à 3 décimales', () => {
    const stat = {
      occurrences: 3,
      upMoves:     1,
      downMoves:   1,
      flatMoves:   1,
      avgUpMove:   1,
      avgDownMove: -1,
      distribution: { bigDown: 0, down: 1, flat: 1, up: 1, bigUp: 0 },
    }
    // 1/3 ≈ 0.333
    const result = computeAdvancedStats(stat)
    expect(result.probUp).toBe(0.333)
    expect(result.probDown).toBe(0.333)
  })
})
