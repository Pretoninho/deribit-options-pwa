/**
 * hooks/useEconomicCalendar.js
 *
 * Hook React pour le calendrier des annonces macro "High" importance.
 * Charge depuis le cache localStorage au montage (instantané),
 * puis rafraîchit depuis l'API TradingEconomics si le cache est périmé.
 * Refresh automatique toutes les heures.
 */

import { useState, useEffect, useCallback } from 'react'
import {
  getEconomicEvents,
  getCachedEconomicEvents,
} from '../../signals/economic_calendar.js'

const REFRESH_INTERVAL_MS = 60 * 60 * 1_000  // 1 heure

/**
 * @returns {{
 *   events:      Array,        — annonces High importance normalisées
 *   loading:     boolean,
 *   error:       string|null,
 *   lastUpdated: number|null,  — timestamp du dernier fetch réussi
 *   refresh:     () => void,   — force un rechargement
 * }}
 */
export default function useEconomicCalendar() {
  const cached = getCachedEconomicEvents()

  const [events,      setEvents]      = useState(cached.events)
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState(null)
  const [lastUpdated, setLastUpdated] = useState(cached.cachedAt)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const ev = await getEconomicEvents()
      setEvents(ev)
      setLastUpdated(Date.now())
    } catch (err) {
      setError(err?.message ?? 'Erreur chargement calendrier')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
    const id = setInterval(refresh, REFRESH_INTERVAL_MS)
    return () => clearInterval(id)
  }, [refresh])

  return { events, loading, error, lastUpdated, refresh }
}
