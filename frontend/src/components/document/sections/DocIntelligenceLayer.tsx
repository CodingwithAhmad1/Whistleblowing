import styles from '../doc.module.css'

export function DocIntelligenceLayer() {
  return (
    <section id="final-section" className={styles.section}>
      <h2 className={styles.h2}>The intelligence layer</h2>
      <p className={styles.p}>
        The three sub-questions in the Full Details section each serve a distinct purpose, and together they
        form a pipeline that runs automatically between Q1 being submitted and the report being filed.
      </p>

      <div className={styles.diagramWrap}>
        <svg width="100%" viewBox="0 0 680 420" role="img" style={{ display: 'block' }}>
          <title>ClearPath AI pipeline diagram</title>
          <desc>
            Flow diagram showing how a reporter's Q1 narrative passes through three AI processing layers to
            produce Q2 and Q3, which together enrich the report before it reaches an investigator.
          </desc>
          <defs>
            <marker id="arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M2 1L8 5L2 9" fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </marker>
          </defs>

          {/* Reporter box */}
          <rect x="40" y="30" width="140" height="52" rx="8" fill="#dbeafe" stroke="#93c5fd" strokeWidth="0.5"/>
          <text x="110" y="52" textAnchor="middle" fontFamily="system-ui, sans-serif" fontSize="13" fontWeight="600" fill="#1d4ed8">Reporter</text>
          <text x="110" y="70" textAnchor="middle" fontFamily="system-ui, sans-serif" fontSize="11" fill="#3b82f6">writes free narrative</text>

          {/* Arrow down */}
          <line x1="110" y1="82" x2="110" y2="118" stroke="#9ca3af" strokeWidth="1" markerEnd="url(#arr)"/>
          <text x="120" y="105" fontFamily="system-ui, sans-serif" fontSize="10" fill="#9ca3af">Q1</text>

          {/* Layer 1 box */}
          <rect x="40" y="120" width="140" height="64" rx="8" fill="#f3e8ff" stroke="#c4b5fd" strokeWidth="0.5"/>
          <text x="110" y="142" textAnchor="middle" fontFamily="system-ui, sans-serif" fontSize="12" fontWeight="600" fill="#6d28d9">Layer 1</text>
          <text x="110" y="158" textAnchor="middle" fontFamily="system-ui, sans-serif" fontSize="10" fill="#7c3aed">AI reads narrative</text>
          <text x="110" y="173" textAnchor="middle" fontFamily="system-ui, sans-serif" fontSize="10" fill="#7c3aed">extracts structured data</text>

          {/* Arrow right to Layer 2 */}
          <line x1="180" y1="152" x2="240" y2="152" stroke="#9ca3af" strokeWidth="1" markerEnd="url(#arr)"/>

          {/* Layer 2 box */}
          <rect x="242" y="120" width="148" height="64" rx="8" fill="#f3e8ff" stroke="#c4b5fd" strokeWidth="0.5"/>
          <text x="316" y="142" textAnchor="middle" fontFamily="system-ui, sans-serif" fontSize="12" fontWeight="600" fill="#6d28d9">Layer 2</text>
          <text x="316" y="158" textAnchor="middle" fontFamily="system-ui, sans-serif" fontSize="10" fill="#7c3aed">checks 7 gap rules</text>
          <text x="316" y="173" textAnchor="middle" fontFamily="system-ui, sans-serif" fontSize="10" fill="#7c3aed">picks highest priority</text>

          {/* Arrow right to Layer 3 */}
          <line x1="390" y1="152" x2="450" y2="152" stroke="#9ca3af" strokeWidth="1" markerEnd="url(#arr)"/>

          {/* Layer 3 box */}
          <rect x="452" y="120" width="148" height="64" rx="8" fill="#f3e8ff" stroke="#c4b5fd" strokeWidth="0.5"/>
          <text x="526" y="142" textAnchor="middle" fontFamily="system-ui, sans-serif" fontSize="12" fontWeight="600" fill="#6d28d9">Layer 3</text>
          <text x="526" y="158" textAnchor="middle" fontFamily="system-ui, sans-serif" fontSize="10" fill="#7c3aed">selects question template</text>
          <text x="526" y="173" textAnchor="middle" fontFamily="system-ui, sans-serif" fontSize="10" fill="#7c3aed">returns Q2 text</text>

          {/* Arrow from Layer 3 down to Q2 */}
          <line x1="526" y1="184" x2="526" y2="224" stroke="#9ca3af" strokeWidth="1" markerEnd="url(#arr)"/>

          {/* Q2 box */}
          <rect x="452" y="226" width="148" height="52" rx="8" fill="#dbeafe" stroke="#93c5fd" strokeWidth="0.5"/>
          <text x="526" y="248" textAnchor="middle" fontFamily="system-ui, sans-serif" fontSize="12" fontWeight="600" fill="#1d4ed8">Q2 shown to reporter</text>
          <text x="526" y="264" textAnchor="middle" fontFamily="system-ui, sans-serif" fontSize="10" fill="#3b82f6">one targeted question</text>

          {/* Arrow from Q2 left toward RAG */}
          <line x1="452" y1="252" x2="380" y2="252" stroke="#9ca3af" strokeWidth="1"/>
          <line x1="380" y1="252" x2="380" y2="310" stroke="#9ca3af" strokeWidth="1" markerEnd="url(#arr)"/>

          {/* RAG box */}
          <rect x="242" y="312" width="276" height="64" rx="8" fill="#f0fdf4" stroke="#86efac" strokeWidth="0.5"/>
          <text x="380" y="334" textAnchor="middle" fontFamily="system-ui, sans-serif" fontSize="12" fontWeight="600" fill="#15803d">Policy search (RAG)</text>
          <text x="380" y="350" textAnchor="middle" fontFamily="system-ui, sans-serif" fontSize="10" fill="#16a34a">AI searches 3M policy document</text>
          <text x="380" y="365" textAnchor="middle" fontFamily="system-ui, sans-serif" fontSize="10" fill="#16a34a">returns most relevant excerpt</text>

          {/* Arrow from RAG left to Q3 box */}
          <line x1="242" y1="344" x2="180" y2="344" stroke="#9ca3af" strokeWidth="1" markerEnd="url(#arr)"/>

          {/* Q3 box */}
          <rect x="40" y="312" width="140" height="64" rx="8" fill="#dbeafe" stroke="#93c5fd" strokeWidth="0.5"/>
          <text x="110" y="334" textAnchor="middle" fontFamily="system-ui, sans-serif" fontSize="12" fontWeight="600" fill="#1d4ed8">Q3 shown to reporter</text>
          <text x="110" y="350" textAnchor="middle" fontFamily="system-ui, sans-serif" fontSize="10" fill="#3b82f6">policy context + question</text>
          <text x="110" y="365" textAnchor="middle" fontFamily="system-ui, sans-serif" fontSize="10" fill="#3b82f6">reporter responds</text>

          {/* Arrow from Q3 up to submit */}
          <line x1="110" y1="312" x2="110" y2="250" stroke="#9ca3af" strokeWidth="1"/>
          <line x1="110" y1="250" x2="110" y2="208" stroke="#9ca3af" strokeWidth="1" markerEnd="url(#arr)"/>

          {/* Submit box */}
          <rect x="40" y="200" width="140" height="40" rx="8" fill="#f0fdf4" stroke="#86efac" strokeWidth="0.5"/>
          <text x="110" y="225" textAnchor="middle" fontFamily="system-ui, sans-serif" fontSize="12" fontWeight="600" fill="#15803d">Report submitted</text>

          {/* Side labels */}
          <text x="15" y="58" fontFamily="system-ui, sans-serif" fontSize="9" fill="#9ca3af" textAnchor="middle" transform="rotate(-90, 15, 140)">Reporter facing</text>
          <text x="15" y="160" fontFamily="system-ui, sans-serif" fontSize="9" fill="#7c3aed" textAnchor="middle" transform="rotate(-90, 15, 158)">AI pipeline</text>
        </svg>
      </div>

      <p className={styles.p}>
        It is worth noting that this pipeline is resilient by design. If any AI step fails — due to a network
        issue or an unexpected response — the form continues and the reporter can still submit. No failure
        silently drops a report.
      </p>
    </section>
  )
}
