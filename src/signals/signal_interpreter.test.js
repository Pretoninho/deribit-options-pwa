import { describe, it, expect } from 'vitest'
import { interpretSignal, strategyEngine } from './signal_interpreter.js'

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

// ── strategyEngine ───────────────────────────────────────────────────────────

describe('strategyEngine — détection des stratégies', () => {
  it('retourne un tableau vide si aucune condition déclenchée', () => {
    expect(strategyEngine({ ivRank: 50, funding: 7, basisAvg: 3, spot: 50000, maxPain: null })).toEqual([])
  })

  it('VOL_EXPANSION : ivRank < 30 → déclenché', () => {
    const result = strategyEngine({ ivRank: 20, funding: 0, basisAvg: 3, spot: null, maxPain: null })
    expect(result.some(s => s.type === 'VOL_EXPANSION')).toBe(true)
  })

  it('VOL_EXPANSION : ivRank = 30 → non déclenché (limite stricte)', () => {
    const result = strategyEngine({ ivRank: 30, funding: 0, basisAvg: 3, spot: null, maxPain: null })
    expect(result.some(s => s.type === 'VOL_EXPANSION')).toBe(false)
  })

  it('FUNDING_REVERSAL : funding > 15 → déclenché avec strength high', () => {
    const result = strategyEngine({ ivRank: 50, funding: 20, basisAvg: 3, spot: null, maxPain: null })
    const s = result.find(s => s.type === 'FUNDING_REVERSAL')
    expect(s).toBeDefined()
    expect(s.strength).toBe('high')
  })

  it('FUNDING_REVERSAL : funding < -10 → déclenché', () => {
    const result = strategyEngine({ ivRank: 50, funding: -15, basisAvg: 3, spot: null, maxPain: null })
    expect(result.some(s => s.type === 'FUNDING_REVERSAL')).toBe(true)
  })

  it('FUNDING_REVERSAL : funding = 10 → non déclenché', () => {
    const result = strategyEngine({ ivRank: 50, funding: 10, basisAvg: 3, spot: null, maxPain: null })
    expect(result.some(s => s.type === 'FUNDING_REVERSAL')).toBe(false)
  })

  it('MAX_PAIN_PLAY : spot dans les 2% du maxPain → déclenché', () => {
    const result = strategyEngine({ ivRank: 50, funding: 0, basisAvg: 3, spot: 49100, maxPain: { maxPainStrike: 50000 } })
    expect(result.some(s => s.type === 'MAX_PAIN_PLAY')).toBe(true)
  })

  it('MAX_PAIN_PLAY : spot à plus de 2% du maxPain → non déclenché', () => {
    const result = strategyEngine({ ivRank: 50, funding: 0, basisAvg: 3, spot: 47000, maxPain: { maxPainStrike: 50000 } })
    expect(result.some(s => s.type === 'MAX_PAIN_PLAY')).toBe(false)
  })

  it('MAX_PAIN_PLAY : maxPain null → non déclenché', () => {
    const result = strategyEngine({ ivRank: 50, funding: 0, basisAvg: 3, spot: 50000, maxPain: null })
    expect(result.some(s => s.type === 'MAX_PAIN_PLAY')).toBe(false)
  })

  it('VOL_CARRY : ivRank > 70 → déclenché', () => {
    const result = strategyEngine({ ivRank: 80, funding: 0, basisAvg: 3, spot: null, maxPain: null })
    expect(result.some(s => s.type === 'VOL_CARRY')).toBe(true)
  })

  it('VOL_CARRY : ivRank = 70 → non déclenché (limite stricte)', () => {
    const result = strategyEngine({ ivRank: 70, funding: 0, basisAvg: 3, spot: null, maxPain: null })
    expect(result.some(s => s.type === 'VOL_CARRY')).toBe(false)
  })

  it('CASH_AND_CARRY : basisAvg > 8 → déclenché avec strength high', () => {
    const result = strategyEngine({ ivRank: 50, funding: 0, basisAvg: 10, spot: null, maxPain: null })
    const s = result.find(s => s.type === 'CASH_AND_CARRY')
    expect(s).toBeDefined()
    expect(s.strength).toBe('high')
  })

  it('CASH_AND_CARRY : basisAvg = 8 → non déclenché', () => {
    const result = strategyEngine({ ivRank: 50, funding: 0, basisAvg: 8, spot: null, maxPain: null })
    expect(result.some(s => s.type === 'CASH_AND_CARRY')).toBe(false)
  })

  it('REGIME_SHIFT : ivRank entre 40-60 et funding proche de zéro → déclenché', () => {
    const result = strategyEngine({ ivRank: 50, funding: 3, basisAvg: 3, spot: null, maxPain: null })
    expect(result.some(s => s.type === 'REGIME_SHIFT')).toBe(true)
  })

  it('REGIME_SHIFT : ivRank hors 40-60 → non déclenché', () => {
    const result = strategyEngine({ ivRank: 35, funding: 0, basisAvg: 3, spot: null, maxPain: null })
    expect(result.some(s => s.type === 'REGIME_SHIFT')).toBe(false)
  })

  it('chaque signal contient type, strength et context', () => {
    const result = strategyEngine({ ivRank: 20, funding: 20, basisAvg: 10, spot: null, maxPain: null })
    for (const s of result) {
      expect(s).toHaveProperty('type')
      expect(s).toHaveProperty('strength')
      expect(s).toHaveProperty('context')
      expect(['low', 'medium', 'high']).toContain(s.strength)
    }
  })
})

// ── intégration strategyEngine dans interpretSignal ──────────────────────────

describe('interpretSignal — intégration dynamicStrategies dans options.action', () => {
  it('action options enrichie avec les stratégies actives', () => {
    const result = interpretSignal(
      { global: 50 },
      { dvol: dvolForRank(20), funding: { rateAnn: 20 }, basisAvg: 10, spot: null },
    )
    const action = result.expert.recommendations.options.action
    expect(action).toContain('Stratégies actives:')
    expect(action).toContain('VOL_EXPANSION')
    expect(action).toContain('FUNDING_REVERSAL')
    expect(action).toContain('CASH_AND_CARRY')
  })

  it('action options non modifiée si aucune stratégie active', () => {
    const result = interpretSignal(
      { global: 50 },
      { dvol: dvolForRank(50), funding: { rateAnn: 7 }, basisAvg: 3, spot: null },
    )
    const action = result.expert.recommendations.options.action
    expect(action).not.toContain('Stratégies actives:')
  })

  it('structure expert.recommendations.options inchangée après enrichissement', () => {
    const result = interpretSignal(
      { global: 50 },
      { dvol: dvolForRank(20), funding: { rateAnn: 20 }, basisAvg: 10, spot: null },
    )
    const opts = result.expert.recommendations.options
    expect(opts).toHaveProperty('signal')
    expect(opts).toHaveProperty('action')
    expect(opts).toHaveProperty('timeframe')
    expect(opts).toHaveProperty('stopLoss')
    expect(opts).toHaveProperty('maxPain')
  })
})

