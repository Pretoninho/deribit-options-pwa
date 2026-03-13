import { blackScholes, calcDIRateBS } from './api.js'

export { calcDIRateBS }

// Ancien modèle ATM simplifié (gardé pour compatibilité)
export function calcPremium(rateAnnual, days, amount) {
  const periodRate = rateAnnual / 100 * (days / 365)
  return amount > 0 ? amount * periodRate : null
}

export function marketPremiumPct(ivPct, days) {
  if (ivPct == null || days <= 0) return null
  const T = days / 365
  return ivPct / 100 * Math.sqrt(T) * 0.4 * 100
}

// Scoring amélioré — utilise BS si strike et spot disponibles, sinon approximation ATM
export function diScoreBS(nexoRatePct, iv, days, spot, strike, type) {
  if (!iv || !days) return null
  let marketRate
  if (spot && strike && type) {
    marketRate = calcDIRateBS(iv, spot, strike, days, type)
  } else {
    // Fallback approximation ATM
    const periodPct = iv / 100 * Math.sqrt(days / 365) * 0.4 * 100
    marketRate = periodPct * (365 / days)
  }
  if (!marketRate) return null
  const nexoPeriod = nexoRatePct / 100 * (days / 365) * 100
  const mktPeriod  = marketRate / 100 * (days / 365) * 100
  return Math.min(nexoPeriod / mktPeriod, 1.5)
}

// Ancien scoring simplifié (fallback)
export function diScore(nexoRatePct, ivPct, days) {
  if (ivPct == null) return null
  const nexoPeriod = nexoRatePct / 100 * (days / 365) * 100
  const mktPeriod  = marketPremiumPct(ivPct, days)
  if (!mktPeriod) return null
  return Math.min(nexoPeriod / mktPeriod, 1.5)
}

export function scoreLabel(ratio) {
  if (ratio == null) return { label: 'N/A', cls: '', bar: 0 }
  if (ratio >= 0.8) return { label: 'Excellent', cls: 'great', bar: ratio }
  if (ratio >= 0.6) return { label: 'Bon',       cls: 'good',  bar: ratio }
  if (ratio >= 0.4) return { label: 'Passable',  cls: 'fair',  bar: ratio }
  return                    { label: 'Faible',    cls: 'poor',  bar: ratio }
}

export function calcPnL(offer, spotNow) {
  const prime = calcPremium(offer.rate, offer.days, offer.amount) ?? 0
  if (!spotNow || !offer.amount) return null
  if (offer.type === 'sell-high') {
    const btcRecu  = offer.amount / offer.strike
    const valBtc   = btcRecu * spotNow
    const pnl      = valBtc - offer.amount + prime
    const pnlPct   = pnl / offer.amount * 100
    const breakEven = (offer.amount - prime) / btcRecu
    return { pnl, pnlPct, breakEven, converted: `+${btcRecu.toFixed(6)} BTC`, prime }
  } else {
    const btcEng   = offer.amount / offer.strike
    const valBtcNow = btcEng * spotNow
    const pnl      = offer.amount - valBtcNow + prime
    const pnlPct   = pnl / offer.amount * 100
    const breakEven = (offer.amount + prime) / btcEng
    return { pnl, pnlPct, breakEven, converted: `+${offer.amount.toLocaleString()} USDC`, prime }
  }
}

export function countdown(expiryDate) {
  const expiryMs = new Date(expiryDate).getTime() + 86400000
  const msLeft   = expiryMs - Date.now()
  if (msLeft <= 0) return 'Échue'
  const dL = Math.floor(msLeft / 86400000)
  const hL = Math.floor((msLeft % 86400000) / 3600000)
  const mL = Math.floor((msLeft % 3600000) / 60000)
  return dL > 0 ? `${dL}j ${hL}h` : `${hL}h ${mL}min`
}

export function fmtUSD(n) {
  if (n == null) return '—'
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function fmtStrike(n) {
  return '$' + n.toLocaleString('en-US', { maximumFractionDigits: 0 })
}

export function fmtExpiry(dateStr) {
  const [y, m, d] = dateStr.split('-')
  const months = ['JAN','FÉV','MAR','AVR','MAI','JUN','JUL','AOÛ','SEP','OCT','NOV','DÉC']
  return `${d} ${months[+m - 1]} ${y.slice(2)}`
}
