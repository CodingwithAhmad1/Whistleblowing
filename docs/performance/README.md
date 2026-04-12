# Performance Notes

## Current Optimizations

### Web Vitals Monitoring

- Performance metrics (CLS, INP, FCP, LCP, TTFB) are reported via `useWebVitals`.
- Use browser console in development to inspect metrics.

### Font Loading

- Font loading uses system fallbacks and `font-display: swap` for perceived performance.
- Custom fonts load progressively.

### Design Tokens

- CSS custom properties (colors, spacing, type scale) in `index.css` keep styling consistent and maintainable.

---

## Backend

### LLM Provider

- **Gemini**: Cloud API via `google-genai` SDK. No local model load; minimal memory footprint (API calls only).
- **SDK pattern**: Uses `genai.Client(api_key=...)` with native async streaming (`client.aio.models.generate_content_stream`). No thread/queue overhead compared to the old `google-generativeai` SDK.
- **genai_config**: `get_client()` resolves the API key in order — explicit argument → `settings.json` `apiKey` (Admin-stored) → `GEMINI_API_KEY` env var — then returns a module-level singleton. The client is re-created only when the resolved key changes, avoiding duplicate construction across `GeminiProvider` and `EmbeddingService`. An Admin API key change takes effect on the next request without a server restart.

### Model Fallback

- **Quota resilience**: `GeminiProvider.generate_stream` catches `ClientError` with code `429` and retries with the next model in the fallback chain (`model_fallback.get_active_model()`).
- **No busy-wait**: The retry is immediate — no `asyncio.sleep()` between tokens or between model switches.
- **Exhaustion state**: In-process only (`mark_model_exhausted` / `is_model_exhausted` in `model_fallback.py`), keyed by UTC date. No per-request file read for quota state.

### Settings Store

- **File locking**: `filelock` used during `update_settings()` to prevent concurrent write races.
- **Atomic write**: Tempfile + rename for crash-safe updates.

### Embeddings

- **InMemoryDocumentStore**: Uses `heapq.nlargest` for top-k similarity search — O(n log k) vs O(n log n) for a full sort.
- **Lazy init**: `EmbeddingService` initialises only on first use, avoiding startup latency.

### Full Details Frontend

- **Q3 cache**: `useQuestionContent` cache key includes `settingsModified` from sessionStorage. Admin saves invalidate Q3 cache so updated templates are used on new Full Details requests.
---

## Future Enhancements

- Service Worker for repeat-visit caching
- Lazy loading for heavy components if added
- Performance budgets in CI/CD
- Bundle analysis for frontend regressions
- Rate limiting middleware on question generation endpoints
