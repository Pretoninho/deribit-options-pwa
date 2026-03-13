const API = 'https://www.deribit.com/api/v2/public'

async function apiFetch(url, timeoutMs = 15000) {
  const timeout = new Promise((_, rej) =>
    setTimeout(() => rej(new Error('Timeout: ' + url.split('/').pop().split('?')[0])), timeoutMs)
  )
  const request = fetch(url).then(async r => {
    if (!r.ok) throw new Error('HTTP ' + r.status)
    return r.json()
  })
  return Promise.race([request, timeout])
}

export async function getSpot(asset) {
  const d = await apiFetch(`${API}/get_index_price?index_name=${asset.toLowerCase()}_usd`)
  return d.result?.index_price ?? null
}

export async function getInstruments(asset) {
  const d = await apiFetch(`${API}/get_instruments?currency=${asset}&kind=option&expired=false`)
  return d.result ?? []
}

export async function getOrderBook(instrument, depth = 1) {
  const d = await apiFetch(`${API}/get_order_book?instrument_name=${instrument}&depth=${depth}`)
  return d.result ?? null
}

export async function getFutures(asset) {
  const d = await apiFetch(`${API}/get_instruments?currency=${asset}&kind=future&expired=false`)
  return d.result ?? []
}

export async function getFuturePrice(instrument) {
  const d = await apiFetch(`${API}/get_order_book?instrument_name=${instrument}&depth=1`)
  return d.result?.mark_price ?? null
}

export async function getATMIV(asset) {
  const spotNow = await getSpot(asset)
  if (!spotNow) throw new Error('No spot for ' + asset)

  const instruments = await getInstruments(asset)
  const timestamps = instruments.map(i => i.expiration_timestamp).filter(t => Number.isFinite(t))
  if (!timestamps.length) throw new Error('No expiry timestamps')

  const minTs = Math.min(...timestamps)
  const front = instruments.filter(i => i.expiration_timestamp === minTs)
  const callStrikes = [...new Set(front.filter(i => i.option_type === 'call').map(i => i.strike))]
  const atmS = callStrikes.reduce((p, c) => Math.abs(c - spotNow) < Math.abs(p - spotNow) ? c : p)

  const callInst = front.find(i => i.option_type === 'call' && i.strike === atmS)
  const putInst  = front.find(i => i.option_type === 'put'  && i.strike === atmS)

  const [cb, pb] = await Promise.all([
    callInst ? getOrderBook(callInst.instrument_name).catch(() => null) : Promise.resolve(null),
    putInst  ? getOrderBook(putInst.instrument_name).catch(() => null)  : Promise.resolve(null),
  ])

  const cIV = cb?.mark_iv ?? null
  const pIV = pb?.mark_iv ?? null
  if (cIV == null && pIV == null) throw new Error('No IV data')

  const iv = (cIV != null && pIV != null) ? (cIV + pIV) / 2 : (cIV ?? pIV)
  return { iv, spot: spotNow, atmStrike: atmS, expiry: new Date(minTs).toISOString() }
}

export function getAllExpiries(instruments) {
  const ts = [...new Set(instruments.map(i => i.expiration_timestamp).filter(t => Number.isFinite(t)))]
  return ts.sort((a, b) => a - b)
}
