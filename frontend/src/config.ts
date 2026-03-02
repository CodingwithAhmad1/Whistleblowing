/**
 * Application configuration constants
 * Centralized config to avoid hardcoded values throughout the codebase
 */

export const LLM_CONFIG = {
  /** Default model ID for WebLLM */
  MODEL_ID: 'Phi-3.5-mini-instruct-q4f16_1-MLC',
  /** Whether to use IndexedDB cache for model files */
  USE_INDEXED_DB_CACHE: true,
} as const

export const UI_CONFIG = {
  /** Throttle delay for input field updates in ms */
  INPUT_THROTTLE_MS: 300,
} as const

export const API_CONFIG = {
  /** Backend API base URL */
  BASE_URL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000',
  /** API endpoints */
  ENDPOINTS: {
    HEALTH: '/api/health',
  },
} as const

export const PARSER_CONFIG = {
  /** Maximum parse attempts per JSON object to prevent O(n²) performance issues */
  MAX_PARSE_ATTEMPTS_PER_OBJECT: 50,
} as const
