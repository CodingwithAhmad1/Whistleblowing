/**
 * Application configuration constants
 * Centralized config to avoid hardcoded values throughout the codebase
 *
 * Dev note: `http://localhost:5173` and `http://127.0.0.1:5173` are different
 * origins (separate localStorage for any client-only data). Use one consistently.
 * The submission feed is stored on the API; CORS allows both. Vite still proxies
 * `/api` to the backend the same for either host.
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
    INTAKE_GAPS: '/api/intake/gaps',
    ADMIN_INTAKE_GAPS: '/api/admin/intake-gaps',
    ADMIN_INTAKE_GAPS_RESET: '/api/admin/intake-gaps/reset',
    RAG_POLICY_QUOTE: '/api/rag/policy-quote',
    RAG_CONSTRUCT_SENTENCE: '/api/rag/construct-sentence',
    RAG_COVERAGE: '/api/rag/coverage',
    SUBMISSIONS: '/api/submissions',
    ACTIVITY_ANALYZE: '/api/admin/activity/analyze',
    ACTIVITY_PROPOSALS: '/api/admin/activity/proposals',
    ACTIVITY_METRICS: '/api/admin/activity/metrics',
    ACTIVITY_CONFIG: '/api/admin/activity/config',
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
