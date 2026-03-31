const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '')

async function fetchJson(path) {
  const response = await fetch(`${API_BASE_URL}${path}`)
  if (!response.ok) {
    let detail = ''
    try {
      const body = await response.json()
      detail = body?.detail || body?.error || ''
    } catch {
      detail = response.statusText
    }
    throw new Error(detail || `HTTP ${response.status}`)
  }
  return response.json()
}

export async function fetchSignals(asset) {
  const assetCode = asset.toUpperCase()
  return fetchJson(`/signals?asset=${encodeURIComponent(assetCode)}`)
}

export function saveSignal(signal) {
  try {
    const history = JSON.parse(localStorage.getItem('veridex_signal_history') || '[]')
    history.push(signal)
    if (history.length > 100) history.shift()
    localStorage.setItem('veridex_signal_history', JSON.stringify(history))
  } catch (err) {
    console.warn('[saveSignal] Error:', err)
  }
}

export function loadSignalHistory() {
  try {
    return JSON.parse(localStorage.getItem('veridex_signal_history') || '[]')
  } catch (err) {
    console.warn('[loadSignalHistory] Error:', err)
    return []
  }
}
