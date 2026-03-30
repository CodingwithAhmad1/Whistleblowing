/**
 * Application configuration constants
 * Centralized config to avoid hardcoded values throughout the codebase
 */

export const UI_CONFIG = {
  /** Throttle delay for input field updates in ms */
  INPUT_THROTTLE_MS: 300,
} as const

export const API_CONFIG = {
  /** Backend API base URL. Use relative URLs when unset so Vite proxy works in dev. */
  BASE_URL: import.meta.env.VITE_API_BASE_URL || '',
  /** API endpoints */
  ENDPOINTS: {
    HEALTH: '/api/health',
    INTAKE_ANALYZE: '/api/questions/intake/analyze',
    ADMIN_SETTINGS: '/api/admin/settings',
    ADMIN_USAGE: '/api/admin/usage',
    ADMIN_INTAKE_GAPS: '/api/admin/intake-gaps',
    ADMIN_INTAKE_GAPS_RESET: '/api/admin/intake-gaps/reset',
    ADMIN_LAST_ANALYSIS: '/api/admin/last-intake-analysis',
    RAG_POLICY_QUOTE: '/api/rag/policy-quote',
    RAG_CONSTRUCT_SENTENCE: '/api/rag/construct-sentence',
    ADMIN_GEMINI_TEST: '/api/admin/gemini-test',
    ADMIN_TEST_PIPELINE: '/api/admin/test/ai-pipeline',
    ADMIN_TEST_HISTORY: '/api/admin/test/history',
    ADMIN_TEST_FIXTURES: '/api/admin/test/fixtures',
  },
} as const

export const PARSER_CONFIG = {
  /** Maximum parse attempts per JSON object to prevent O(n²) performance issues */
  MAX_PARSE_ATTEMPTS_PER_OBJECT: 50,
} as const
