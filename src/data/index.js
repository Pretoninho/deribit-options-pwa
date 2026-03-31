/**
 * data/index.js — Point d'entrée unique du Data Core
 *
 * Toute la couche supérieure (core, signals, strategy, UI)
 * importe exclusivement depuis ici. Jamais directement depuis les sous-modules.
 *
 * Architecture :
 *
 *   data/
 *   ├── providers/      ← appels REST par plateforme
 *   ├── streams/        ← WebSocket (temps réel) + polling (fallback)
 *   ├── normalizers/    ← transformation en format canonique
 *   └── data_store/     ← cache central + subscriptions
 */

// ── Exports : store ───────────────────────────────────────────────────────────
export { dataStore, CacheKey, SmartCache, smartCache, fnv1a, hashData } from './data_store/cache.js'
export { POLL, HASH_CONFIG } from './data_store/hash_config.js'

export {
  getCacheChangeLog,
  clearCacheChangeLog,
} from './data_store/cache.js'

export {
  buildSearchIndex,
  filterByHash,
  filterByDate,
  filterByEvent,
  applyFilters,
} from './data_store/hash_search.js'

// ── Exports : providers ───────────────────────────────────────────────────────
// v2.0: Deribit only
export * as deribit  from './providers/deribit.js'

// ── Exports : clock sync ──────────────────────────────────────────────────────
export {
  syncServerClocks,
  getNextFundingTime,
  getTimeCorrected,
  getDaysUntilCorrected,
  SYNC_INTERVAL_MS,
} from './providers/clock_sync.js'

export { getDeribitTime }  from './providers/deribit.js'

export { getCachedClockSync, setCachedClockSync } from './data_store/cache.js'

// ── Exports : streams ─────────────────────────────────────────────────────────
export { wsStream, DeribitChannels }     from './streams/websocket.js'
export { pollingStream, PollInterval, pollToStore } from './streams/polling.js'

// ── Exports : normalizers ─────────────────────────────────────────────────────
export {
  // Deribit
  normalizeDeribitSpot,
  normalizeDeribitOrderBook,
  normalizeDeribitOption,
  normalizeDeribitDVOL,
  normalizeDeribitFunding,
  normalizeDeribitOI,
  normalizeDeribitFundingHistory,
  normalizeDeribitDeliveryPrices,
  normalizeDeribitTrades,
  // Utilitaires
  validateDataFreshness,
  normalizeOnChain,
  getHistoricalContext,
} from './normalizers/format_data.js'

// ── Exports : Max Pain ────────────────────────────────────────────────────────
export {
  parseInstrument,
  calculateMaxPain,
  calculateMaxPainByExpiry,
  interpretMaxPain,
} from '../core/volatility/max_pain.js'

// ── Exports : Settlement Tracker ──────────────────────────────────────────────
export {
  setupSettlementWatcher,
  captureSettlement,
  getSettlementHistory,
  getSettlementByDate,
  getSettlementByHash,
  clearSettlementHistory,
} from '../signals/settlement_tracker.js'

// ── Exports : Notification Engine ─────────────────────────────────────────────
export {
  checkNotifications,
  notifyAnomaly,
} from '../signals/notification_engine.js'

// ── Exports : Notification Manager ────────────────────────────────────────────
export {
  DEFAULT_THRESHOLDS,
  requestPermission,
  getPermissionStatus,
  getThresholds,
  updateThreshold,
  resetThresholds,
  sendNotification,
  getNotificationHistory,
  clearNotificationHistory,
} from '../signals/notification_manager.js'

// ── Exports : signals ───────────────────────────────────────────────────────────
export {
  detectMarketAnomaly,
  hashMarketState,
  saveSignal,
  getSignalHistory,
  getAnomalyLog,
  clearAnomalyLog,
} from '../signals/signal_engine.js'
