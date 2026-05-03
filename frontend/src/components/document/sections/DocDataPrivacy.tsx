import styles from '../doc.module.css'
import { DocCallout } from '../DocCallout'

export function DocDataPrivacy(): JSX.Element {
  return (
    <section id="data-privacy" className={styles.section}>
      <hr className={styles.hr} />
      <h2 className={styles.h2}>Data and privacy</h2>

      <h3 className={styles.h3}>AI processing and third-party services</h3>
      <p className={styles.p}>
        ReportIQ&apos;s prototype stack sends report text to <strong>Google Gemini</strong> for Layer 1
        extraction, constructed sentences, reranking, and related LLM steps. Embedding calls (for example
        text-embedding-004) also route through Google&apos;s API for both policy indexing and query-time
        retrieval. Policy chunks themselves live in a local <strong>Chroma</strong> database under{' '}
        <code>backend/data/chroma</code> after ingestion — the content is on disk in the deployment, but
        generating new embeddings still uses the remote embedding service unless reconfigured.
      </p>

      <DocCallout variant="amber">
        <p>
          <strong>Prototype note:</strong> treat current traffic as demonstration data. A production deployment
          at an enterprise such as 3M would need DPAs, regional residency choices, or private inference as
          required by policy.
        </p>
      </DocCallout>

      <h3 className={styles.h3}>Reporter anonymity</h3>
      <p className={styles.p}>
        Reporters may withhold identifying fields. When they remain anonymous, contact data should be absent from
        the stored submission; when they disclose identity, those values reside inside the submission payload and
        appear to reviewers who open that row — they are not meant for public aggregates in this prototype.
      </p>

      <h3 className={styles.h3}>Submission storage</h3>
      <p className={styles.p}>
        Every save writes to <strong>localStorage</strong> as a fallback. When the backend is reachable,
        submissions also post to <code>/api/submissions</code>, which is how Feed rows stay consistent across
        teammates testing against the same API. There is no production-grade database in-repo; wire persistent
        storage and access control before handling real matters.
      </p>
    </section>
  )
}
