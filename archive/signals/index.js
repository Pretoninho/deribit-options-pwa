/**
 * signals/index.js — Scoring and signal-related logic
 *
 * Simplified for Veridex refactor: core signals only (no patterns, insights, on-chain, snapshots)
 */

export {
  scoreIV,
  scoreFunding,
  scoreBasis,
  scoreIVvsRV,
  calcGlobalScore,
  getSignal,
  computeSignal,
  detectMarketAnomaly,
  hashMarketState,
  saveSignal,
  getSignalHistory,
  getAnomalyLog,
  clearAnomalyLog,
} from './signal_engine.js'

export { interpretSignal, buildStrategySignature, buildMarketRegime } from './signal_interpreter.js'

export { setupSettlementWatcher, captureSettlement, getSettlementHistory, getSettlementByDate, getSettlementByHash, clearSettlementHistory } from './settlement_tracker.js'

export { checkNotifications, notifyAnomaly } from './notification_engine.js'

export { DEFAULT_THRESHOLDS, requestPermission, getPermissionStatus, getThresholds, updateThreshold, resetThresholds, sendNotification, getNotificationHistory, clearNotificationHistory } from './notification_manager.js'
