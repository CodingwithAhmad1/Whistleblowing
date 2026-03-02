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

## Backend

### LLM Provider

- **Gemini**: Cloud API; no local model load.
- **Ollama**: Local; model must be pre-pulled.
- **Local Phi**: Downloads on first run (~2.3 GB); cached in `backend/models/`.

### Memory Usage

- **Gemini**: Minimal (API calls only).
- **Ollama / Local Phi**: ~2–3 GB when model is loaded.

## Future Enhancements

- Service Worker for repeat-visit caching
- Lazy loading for heavy components if added
- Performance budgets in CI/CD
- Bundle analysis for frontend regressions
