function normalPdf(x) {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI)
}

function normalCdf(x) {
  const a1 = 0.319381530
  const a2 = -0.356563782
  const a3 = 1.781477937
  const a4 = -1.821255978
  const a5 = 1.330274429
  const p = 0.2316419

  if (x < 0) return 1 - normalCdf(-x)
  const t = 1 / (1 + p * x)
  const poly = ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t
  return 1 - normalPdf(x) * poly
}

export function calcOptionGreeks({ type, S, K, T, sigma, r = 0 }) {
  if (!Number.isFinite(S) || !Number.isFinite(K) || !Number.isFinite(T) || !Number.isFinite(sigma)) return null
  if (S <= 0 || K <= 0 || T <= 0 || sigma <= 0) return null
  if (type !== 'call' && type !== 'put') return null

  const sqrtT = Math.sqrt(T)
  const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * sqrtT)
  const d2 = d1 - sigma * sqrtT
  const nd1 = normalPdf(d1)
  const cdfD1 = normalCdf(d1)
  const cdfD2 = normalCdf(d2)

  const gamma = nd1 / (S * sigma * sqrtT)
  const vega = (S * nd1 * sqrtT) / 100

  if (type === 'call') {
    const delta = cdfD1
    const theta = ((-(S * nd1 * sigma) / (2 * sqrtT) - r * K * Math.exp(-r * T) * cdfD2) / 365)
    return { delta, gamma, theta, vega }
  }

  const delta = cdfD1 - 1
  const theta = ((-(S * nd1 * sigma) / (2 * sqrtT) + r * K * Math.exp(-r * T) * normalCdf(-d2)) / 365)
  return { delta, gamma, theta, vega }
}