import { describe, it, expect } from 'vitest'
import { interpretSignal } from './signal_interpreter.js'

// Helper : construit un dvol tel que ivRank = valeur voulue (0-100)
const dvolForRank = (rank) => ({
  current:  rank,
  monthMin: 0,
  monthMax: 100,
})

// Helper : appelle interpretSignal avec le minimum requis
const optionsSignal = (score, dvol) =>
  interpretSignal({ global: score }, { dvol }).expert.recommendations.options.signal

// Helper : retourne l'objet options complet avec tous les inputs disponibles
const optionsReco = (score, rawData) =>
  interpretSignal({ global: score }, rawData).expert.recommendations.options

// ── _getVolRegime (testé via _optionsReco via interpretSignal) ───────────────

describe('_getVolRegime — régime de volatilité', () => {
  it('ivRank >= 70 → HIGH_VOL → prioritise "Vendre la vol"', () => {
    expect(optionsSignal(50, dvolForRank(70))).toBe('Vendre la vol')
    expect(optionsSignal(50, dvolForRank(75))).toBe('Vendre la vol')
    expect(optionsSignal(50, dvolForRank(100))).toBe('Vendre la vol')
  })

  it('ivRank <= 30 → LOW_VOL → prioritise "Acheter la vol"', () => {
    expect(optionsSignal(90, dvolForRank(30))).toBe('Acheter la vol')
    expect(optionsSignal(90, dvolForRank(20))).toBe('Acheter la vol')
    expect(optionsSignal(90, dvolForRank(0))).toBe('Acheter la vol')
  })

  it('31 <= ivRank <= 69 → NEUTRAL → utilise le score', () => {
    // Score 85 dans NEUTRAL → "Vendre la vol"
    expect(optionsSignal(85, dvolForRank(50))).toBe('Vendre la vol')
    // Score 65 dans NEUTRAL → "Spreads vendeurs"
    expect(optionsSignal(65, dvolForRank(50))).toBe('Spreads vendeurs')
    // Score 45 dans NEUTRAL → "Achats sélectifs"
    expect(optionsSignal(45, dvolForRank(50))).toBe('Achats sélectifs')
    // Score 20 dans NEUTRAL → "Acheter la vol"
    expect(optionsSignal(20, dvolForRank(50))).toBe('Acheter la vol')
  })

  it('ivRank null (dvol absent) → NEUTRAL → utilise le score', () => {
    expect(optionsSignal(85, null)).toBe('Vendre la vol')
    expect(optionsSignal(20, null)).toBe('Acheter la vol')
  })
})

// ── _optionsReco — le régime prime sur le score ──────────────────────────────

describe('_optionsReco — régime prime sur le score', () => {
  it('HIGH_VOL avec score faible → "Vendre la vol" (régime > score)', () => {
    // Score = 30 → normalement "Acheter la vol", mais HIGH_VOL prend le dessus
    expect(optionsSignal(30, dvolForRank(80))).toBe('Vendre la vol')
  })

  it('LOW_VOL avec score élevé → "Acheter la vol" (régime > score)', () => {
    // Score = 90 → normalement "Vendre la vol", mais LOW_VOL prend le dessus
    expect(optionsSignal(90, dvolForRank(10))).toBe('Acheter la vol')
  })

  it('HIGH_VOL exact (ivRank=70) → "Vendre la vol"', () => {
    expect(optionsSignal(40, dvolForRank(70))).toBe('Vendre la vol')
  })

  it('LOW_VOL exact (ivRank=30) → "Acheter la vol"', () => {
    expect(optionsSignal(80, dvolForRank(30))).toBe('Acheter la vol')
  })
})

// ── _optionsReco — format de retour intact ───────────────────────────────────

describe('_optionsReco — format de retour intact', () => {
  it('retourne signal, action, timeframe, stopLoss, maxPain', () => {
    const result = interpretSignal({ global: 85 }, { dvol: dvolForRank(75), spot: 50000 })
    const opts = result.expert.recommendations.options
    expect(opts).toHaveProperty('signal')
    expect(opts).toHaveProperty('action')
    expect(opts).toHaveProperty('timeframe')
    expect(opts).toHaveProperty('stopLoss')
    expect(opts).toHaveProperty('maxPain')
  })

  it('action contient le IV Rank correct', () => {
    const result = interpretSignal({ global: 85 }, { dvol: dvolForRank(75) })
    expect(result.expert.recommendations.options.action).toContain('IV Rank 75%')
  })
})

// ── _optionsReco — contexte enrichi (funding, basisAvg, rv) ─────────────────

describe('_optionsReco — contexte enrichi funding / basis / rv', () => {
  it('funding élevé (≥15%/an) → action contient le contexte surextension', () => {
    const opts = optionsReco(65, {
      dvol: dvolForRank(50),
      funding: { rateAnn: 20 },
    })
    expect(opts.action).toContain('funding élevé')
    expect(opts.action).toContain('20.0%/an')
  })

  it('funding modéré (5-14%/an) → action contient le contexte biais haussier', () => {
    const opts = optionsReco(65, {
      dvol: dvolForRank(50),
      funding: { rateAnn: 8 },
    })
    expect(opts.action).toContain('funding modéré')
    expect(opts.action).toContain('8.0%/an')
  })

  it('funding négatif (≤-5%/an) → action contient le contexte pression baissière', () => {
    const opts = optionsReco(45, {
      dvol: dvolForRank(50),
      funding: { rateAnn: -8 },
    })
    expect(opts.action).toContain('funding négatif')
    expect(opts.action).toContain('-8.0%/an')
  })

  it('basis fort contango (≥8%/an) → action contient le contexte contango', () => {
    const opts = optionsReco(65, {
      dvol: dvolForRank(50),
      basisAvg: 10,
    })
    expect(opts.action).toContain('contango fort')
    expect(opts.action).toContain('10.0%/an')
  })

  it('backwardation (≤-2%/an) → action contient le contexte backwardation', () => {
    const opts = optionsReco(45, {
      dvol: dvolForRank(50),
      basisAvg: -3,
    })
    expect(opts.action).toContain('backwardation')
    expect(opts.action).toContain('-3.0%/an')
  })

  it('IV > RV → action mentionne vol implicite chère', () => {
    const opts = optionsReco(65, {
      dvol: { current: 80, monthMin: 0, monthMax: 100 },
      rv: { current: 50 },
    })
    expect(opts.action).toContain('IV > RV')
  })

  it('IV < RV → action mentionne vol implicite bon marché', () => {
    const opts = optionsReco(45, {
      dvol: { current: 40, monthMin: 0, monthMax: 100 },
      rv: { current: 60 },
    })
    expect(opts.action).toContain('IV < RV')
  })

  it('sans funding ni basis → action sans contexte funding/basis (pas de crash)', () => {
    const opts = optionsReco(65, { dvol: dvolForRank(50) })
    expect(opts).toHaveProperty('signal')
    expect(opts).toHaveProperty('action')
    expect(opts.action).not.toContain('funding')
    expect(opts.action).not.toContain('basis')
  })

  it('maxPain avec maxPainStrike → action contient Max Pain', () => {
    const opts = optionsReco(85, {
      dvol: dvolForRank(75),
      spot: 50000,
    })
    // Pass maxPain via computedSignal
    const result = interpretSignal(
      { global: 85, maxPain: { maxPainStrike: 48000 } },
      { dvol: dvolForRank(75), spot: 50000 },
    )
    expect(result.expert.recommendations.options.action).toContain('Max Pain')
    expect(result.expert.recommendations.options.action).toContain('48')
  })
})

