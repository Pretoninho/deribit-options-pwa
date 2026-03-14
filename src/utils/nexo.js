export function parseNexoCSV(text) {
  const lines = text.trim().split('\n')
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''))
  const rows = lines.slice(1).map(line => {
    const cols = []
    let current = '', inQuote = false
    for (const char of line) {
      if (char === '"') { inQuote = !inQuote }
      else if (char === ',' && !inQuote) { cols.push(current.trim()); current = '' }
      else { current += char }
    }
    cols.push(current.trim())
    const obj = {}
    headers.forEach((h, i) => obj[h] = cols[i] ?? '')
    return obj
  }).filter(r => r['Type']?.startsWith('Dual Investment') && r['Details']?.includes('approved'))
  return rows
}

export function buildContracts(rows) {
  const sorted = [...rows].sort((a, b) => new Date(a['Date / Time (UTC)']) - new Date(b['Date / Time (UTC)']))
  const locks     = sorted.filter(r => r['Type'] === 'Dual Investment Lock')
  const unlocks   = sorted.filter(r => r['Type'] === 'Dual Investment Unlock')
  const interests = sorted.filter(r => r['Type'] === 'Dual Investment Interest')
  const exchanges = sorted.filter(r => r['Type'] === 'Dual Investment Exchange')
  const contracts = []
  const usedUnlocks   = new Set()
  const usedInterests = new Set()
  const usedExchanges = new Set()

  for (const lock of locks) {
    const lockDate   = new Date(lock['Date / Time (UTC)'])
    const lockAsset  = lock['Input Currency']
    const lockAmount = Math.abs(parseFloat(lock['Input Amount']))
    const lockUSD    = Math.abs(parseFloat(lock['USD Equivalent']))

    let settlement = null
    let converted  = false

    const matchExchange = exchanges.find(e => {
      if (usedExchanges.has(e['Transaction'])) return false
      const eDate = new Date(e['Date / Time (UTC)'])
      if (eDate <= lockDate) return false
      return e['Input Currency'] === lockAsset || e['Output Currency'] === lockAsset
    })

    const matchUnlock = unlocks.find(u => {
      if (usedUnlocks.has(u['Transaction'])) return false
      const uDate = new Date(u['Date / Time (UTC)'])
      if (uDate <= lockDate) return false
      return u['Input Currency'] === lockAsset
    })

    if (matchExchange) {
      const exchDate   = new Date(matchExchange['Date / Time (UTC)'])
      const unlockDate = matchUnlock ? new Date(matchUnlock['Date / Time (UTC)']) : null
      if (!unlockDate || exchDate <= unlockDate) {
        settlement = matchExchange
        converted  = true
        usedExchanges.add(matchExchange['Transaction'])
      } else {
        settlement = matchUnlock
        converted  = false
        usedUnlocks.add(matchUnlock['Transaction'])
      }
    } else if (matchUnlock) {
      settlement = matchUnlock
      converted  = false
      usedUnlocks.add(matchUnlock['Transaction'])
    }

    if (!settlement) continue

    const settleDate = new Date(settlement['Date / Time (UTC)'])
    const days = Math.max(1, Math.round((settleDate - lockDate) / 86400000))

    const matchInterest = interests.find(i => {
      if (usedInterests.has(i['Transaction'])) return false
      const iDate  = new Date(i['Date / Time (UTC)'])
      const diffMs = Math.abs(iDate - settleDate)
      return diffMs < 60000
    })

    let interestUSD = 0, interestAmount = 0, interestAsset = lockAsset
    if (matchInterest) {
      interestUSD    = parseFloat(matchInterest['USD Equivalent']) || 0
      interestAmount = parseFloat(matchInterest['Input Amount'])   || 0
      interestAsset  = matchInterest['Input Currency']
      usedInterests.add(matchInterest['Transaction'])
    }

    const apyReal = lockUSD > 0 ? (interestUSD / lockUSD) * (365 / days) * 100 : 0

    let type = 'sell-high'
    if (lockAsset === 'USDC' || lockAsset === 'USDT') type = 'buy-low'

    let pnlUSD = null
    if (converted) {
      const outputUSD = parseFloat(settlement['USD Equivalent']) || 0
      pnlUSD = outputUSD - lockUSD + interestUSD
    }

    contracts.push({
      id: lock['Transaction'],
      lockDate:       lock['Date / Time (UTC)'],
      settleDate:     settlement['Date / Time (UTC)'],
      days,
      asset:          lockAsset,
      amountLocked:   lockAmount,
      lockUSD,
      type,
      converted,
      interestUSD,
      interestAmount,
      interestAsset,
      apyReal,
      pnlUSD,
      settleUSD: parseFloat(settlement['USD Equivalent']) || 0,
    })
  }

  return contracts.sort((a, b) => new Date(b.lockDate) - new Date(a.lockDate))
}

export function calcStats(contracts) {
  if (!contracts.length) return null
  const totalPrime   = contracts.reduce((s, c) => s + c.interestUSD, 0)
  const totalLocked  = contracts.reduce((s, c) => s + c.lockUSD, 0)
  const converted    = contracts.filter(c => c.converted)
  const notConverted = contracts.filter(c => !c.converted)
  const apyValues    = contracts.map(c => c.apyReal).filter(v => v > 0)
  const avgAPY       = apyValues.length ? apyValues.reduce((a,b)=>a+b,0)/apyValues.length : 0
  const avgDays      = contracts.reduce((s,c)=>s+c.days,0)/contracts.length

  const byAsset = {}
  for (const c of contracts) {
    if (!byAsset[c.asset]) byAsset[c.asset] = { count:0, prime:0, locked:0, converted:0 }
    byAsset[c.asset].count++
    byAsset[c.asset].prime     += c.interestUSD
    byAsset[c.asset].locked    += c.lockUSD
    byAsset[c.asset].converted += c.converted ? 1 : 0
  }

  const sellHigh = contracts.filter(c => c.type === 'sell-high')
  const buyLow   = contracts.filter(c => c.type === 'buy-low')

  const byMonth = {}
  for (const c of contracts) {
    const month = c.lockDate.slice(0, 7)
    if (!byMonth[month]) byMonth[month] = { prime:0, count:0 }
    byMonth[month].prime += c.interestUSD
    byMonth[month].count++
  }

  return {
    total: contracts.length,
    totalPrime,
    totalLocked,
    conversionRate:    converted.length / contracts.length * 100,
    convertedCount:    converted.length,
    notConvertedCount: notConverted.length,
    avgAPY,
    avgDays,
    byAsset,
    sellHighCount: sellHigh.length,
    buyLowCount:   buyLow.length,
    sellHighPrime: sellHigh.reduce((s,c)=>s+c.interestUSD,0),
    buyLowPrime:   buyLow.reduce((s,c)=>s+c.interestUSD,0),
    byMonth,
  }
}
