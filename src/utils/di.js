import { blackScholes, calcDIRateBS } from './api.js'

export { calcDIRateBS }

export function calcPremium(rateAnnual, days, amount) {
  const periodRate = rateAnnual / 100 * (days / 365)
  return amount > 0 ? amount * periodRate : null
}

export function marketPremiumPct(ivPct, days) {
  if (ivPct == null || days <= 0) return null
  const T = days / 365
  return ivPct / 100 * Math.sqrt(T) * 0.4 * 100
}

export function diScoreBS(nexoRatePct, iv, days, spot, strike, type) {
  if (!iv || !days) return null
  let marketRate
  if (spot && strike && type) {
    marketRate = calcDIRateBS(iv, spot, strike, days, type)
  } else {
    const periodPct = iv / 100 * Math.sqrt(days / 365) * 0.4 * 100
    marketRate = periodPct * (365 / days)
  }
  if (!marketRate) return null
  const nexoPeriod = nexoRatePct / 100 * (days / 365) * 100
  const mktPeriod  = marketRate / 100 * (days / 365) * 100
  return Math.min(nexoPeriod / mktPeriod, 1.5)
}

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

export function calcPnL(offer, spotNow, dca) {
  const prime = calcPremium(offer.rate, offer.days, offer.amount) ?? 0
  if (!offer.amount) return null

  if (offer.type === 'sell-high') {
    // Tu engages du BTC, tu veux vendre au strike
    // Quantité BTC engagée = amount / strike (on stocke en USD)
    const btcAmount = offer.amount / offer.strike

    // PnL si exercé = (strike - DCA) × btcAmount + prime
    // Si pas de DCA fourni, on utilise le spot actuel comme référence
    const refPrice = dca || spotNow
    const pnlIfExercised = refPrice
      ? (offer.strike - refPrice) * btcAmount + prime
      : null
    const pnlPctIfExercised = refPrice && offer.amount
      ? ((offer.strike - refPrice) * btcAmount + prime) / (refPrice * btcAmount) * 100
      : null

    // Statut actuel
    const willBeExercised = spotNow ? spotNow >= offer.strike : null

    // Manque à gagner : si BTC monte au-dessus du strike à l'expiry,
    // tu aurais pu vendre au prix marché plutôt qu'au strike
    // On calcule pour différents scénarios de prix
    const scenarios = spotNow ? [
      { label: 'Strike +5%',  price: offer.strike * 1.05 },
      { label: 'Strike +10%', price: offer.strike * 1.10 },
      { label: 'Strike +20%', price: offer.strike * 1.20 },
    ].map(s => ({
      label: s.label,
      price: s.price,
      manque: (s.price - offer.strike) * btcAmount,
    })) : []

    // Distance strike vs spot
    const distPct = spotNow ? (offer.strike - spotNow) / spotNow * 100 : null

    return {
      type: 'sell-high',
      btcAmount,
      prime,
      pnlIfExercised,
      pnlPctIfExercised,
      willBeExercised,
      distPct,
      scenarios,
      // Si non exercé : tu gardes ton BTC + prime
      keepBTC: !willBeExercised,
    }

  } else {
    // Buy Low : tu engages des USDC, tu veux acheter du BTC au strike
    const btcIfExercised = offer.amount / offer.strike

    // PnL si exercé = (DCA ou spot - strike) × btcIfExercised + prime
    // Tu achètes sous le DCA = positif
    const refPrice = dca || spotNow
    const pnlIfExercised = refPrice
      ? (refPrice - offer.strike) * btcIfExercised + prime
      : null
    const pnlPctIfExercised = offer.amount
      ? ((refPrice ? (refPrice - offer.strike) * btcIfExercised : 0) + prime) / offer.amount * 100
      : null

    const willBeExercised = spotNow ? spotNow <= offer.strike : null
    const distPct = spotNow ? (spotNow - offer.strike) / offer.strike * 100 : null

    // Manque à gagner si BTC descend bien en dessous du strike
    const scenarios = spotNow ? [
      { label: 'Strike -5%',  price: offer.strike * 0.95 },
      { label: 'Strike -10%', price: offer.strike * 0.90 },
      { label: 'Strike -20%', price: offer.strike * 0.80 },
    ].map(s => ({
      label: s.label,
      price: s.price,
      manque: (offer.strike - s.price) * btcIfExercised,
    })) : []

    return {
      type: 'buy-low',
      btcIfExercised,
      prime,
      pnlIfExercised,
      pnlPctIfExercised,
      willBeExercised,
      distPct,
      scenarios,
      keepUSDC: !willBeExercised,
    }
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
