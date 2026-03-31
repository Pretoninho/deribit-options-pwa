/**
 * core/index.js — Pure calculation functions
 *
 * Active exports used by the application runtime.
 */

export {
  parseInstrument,
  calculateMaxPain,
  calculateMaxPainByExpiry,
  interpretMaxPain,
} from './volatility/max_pain.js'
