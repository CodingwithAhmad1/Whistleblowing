/** Types for the Admin ▸ Activity tab (Component C: amendment proposals). */

export interface PinnedRef {
  corpus: string
  document_id: string | null
  section: string | null
  char_span: [number, number] | null
}

export interface DiffSpan {
  op: 'replace' | 'insert' | 'delete'
  anchor_span: [number, number]
  proposed_span: [number, number]
}

export type ProposalStatus = 'pending' | 'accepted' | 'modified' | 'rejected'

export interface AmendmentProposal {
  proposal_id: string
  kind: 'amendment' | 'coverage_notice'
  cluster_id: string
  contributing_submission_ids: number[]
  anchor_ref: PinnedRef | null
  anchor_text: string | null
  proposed_text: string | null
  diff_spans: DiffSpan[]
  legal_ref: PinnedRef | null
  /** Model-authored text — rendered visually separate, labeled as AI. */
  rationale: string | null
  notice: string | null
  status: ProposalStatus
  reviewer_decision: {
    action: 'accept' | 'modify' | 'reject'
    modified_text: string | null
    reason: string | null
    decided_at: string
  } | null
  created_at: string
}

export interface CoverageCluster {
  cluster_id: string
  member_submission_ids: number[]
  intra_sim: number
  coverage_classes: Record<string, number>
  first_seen: string | null
  last_seen: string | null
  status: string
  is_candidate: boolean
}

export interface ActivityMetrics {
  window_days: number
  counts: Record<string, number>
  total_classified: number
  legal_only_rate: number | null
  proposals: {
    amendments: number
    coverage_notices: number
    unanchored_rejection_rate: number | null
    decisions: Record<string, number>
  }
}

export interface AmendmentConfig {
  nMin: number
  simMin: number
  windowDays: number
}

export interface AnalyzeResult {
  clusters: CoverageCluster[]
  config: AmendmentConfig
  proposals_created: number
  notices_created: number
  skipped_existing: number
  inputs_considered: number
  /** Clusters where generation could not run (LLM outage) — no record was created. */
  generation_failures: number
}
