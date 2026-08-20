"""Component C — policy amendment proposals.

Accumulates coverage gaps (legal_only / uncovered submissions), clusters them
by conduct similarity over the extracted schema, and proposes anchored policy
amendments as diffs. Proposals never amend anything: they route to a reviewer
(accept / modify / reject) via the Activity tab (C4 human gate).

Naming note: "gap" in this codebase means an *intake* gap (missing detail in
one report). Component C concepts use distinct names: coverage class, coverage
cluster, amendment proposal.
"""
