"""Labelled vignettes for retrieval calibration (constructed, per spec — no live data).

Each vignette is a conduct description with ground truth:
  expected_class          the correct coverage classification given the two
                          indexed corpora (3M Code of Conduct; EU Directive 2019/1937)
  policy_section_contains substring expected in the retrieved policy section (citation check)
  legal_section_contains  substring expected in the retrieved legal section (citation check)

Used by scripts/eval_retrieval.py to sweep τ and report precision/recall and
citation accuracy. This set is also the seed for future conformal calibration —
grow it before trusting any statistical guarantee.

Labelling rationale:
  covered      3M code addresses it AND it falls in the Directive's material scope
  policy_only  3M code addresses it, but it is not a breach of Union law in scope
  legal_only   in the Directive's scope (Art. 2) but absent from the 3M code
  uncovered    neither corpus addresses it
"""

COVERAGE_VIGNETTES: list[dict] = [
    # ── covered: firm policy + Union law both address it ─────────────────────
    {
        "id": "expense_fraud",
        "query": (
            "A supervisor has been submitting fraudulent expense reports with duplicate "
            "receipts for travel that never took place, totaling over $50,000, and signing "
            "off the monthly reconciliation reports himself."
        ),
        "expected_class": "covered",
        "policy_section_contains": "Accurate Books",
    },
    {
        "id": "insider_trading",
        "query": (
            "A finance director bought company shares days before the public announcement "
            "of a major acquisition, using confidential deal information obtained in "
            "board preparation meetings."
        ),
        "expected_class": "covered",
        "policy_section_contains": "Insider Trading",
    },
    {
        "id": "bribery_official",
        "query": (
            "A sales manager offered cash payments to a government procurement officer to "
            "secure a public tender for medical supplies."
        ),
        "expected_class": "covered",
        "policy_section_contains": "Bribery",
    },
    {
        "id": "money_laundering",
        "query": (
            "A distributor insists on paying invoices through a chain of unrelated offshore "
            "shell companies and requests that payments be split below reporting thresholds."
        ),
        "expected_class": "covered",
        "policy_section_contains": "Money Laundering",
    },
    {
        "id": "retaliation_after_report",
        "query": (
            "After reporting suspected accounting irregularities to the compliance hotline, "
            "an employee was demoted, excluded from meetings, and threatened with dismissal."
        ),
        "expected_class": "covered",
        "legal_section_contains": "retaliation",
    },
    # ── legal_only: Directive scope, not in the firm's code ──────────────────
    {
        "id": "food_safety",
        "query": (
            "A plant quality inspector found that expired raw ingredients are being relabeled "
            "with new dates and used in food products shipped to retailers, violating food "
            "safety requirements."
        ),
        "expected_class": "legal_only",
    },
    {
        "id": "animal_welfare",
        "query": (
            "Laboratory staff are ignoring animal welfare requirements: test animals are kept "
            "in undersized cages without veterinary oversight, and inspection records are "
            "being falsified."
        ),
        "expected_class": "legal_only",
    },
    {
        "id": "transport_safety",
        "query": (
            "A logistics coordinator is instructing drivers to disable tachographs and exceed "
            "legal driving-hour limits on international freight routes, endangering road "
            "transport safety."
        ),
        "expected_class": "legal_only",
    },
    {
        "id": "radiation_protection",
        "query": (
            "Technicians at an industrial site are bypassing radiation protection protocols "
            "for sealed sources and dosimetry badges are not being issued to exposed workers."
        ),
        "expected_class": "legal_only",
    },
    # ── policy_only: firm code addresses it, outside Union-law scope ──────────
    {
        "id": "gifts_entertainment",
        "query": (
            "A purchasing agent accepted lavish gifts, concert tickets, and a weekend resort "
            "stay from a supplier during an active vendor selection process."
        ),
        "expected_class": "policy_only",
        "policy_section_contains": "Business Courtesies",
    },
    {
        "id": "conflict_of_interest",
        "query": (
            "A department head hired her brother-in-law's consulting firm without disclosing "
            "the family relationship and approves his invoices herself."
        ),
        "expected_class": "policy_only",
        "policy_section_contains": "Conflicts of Interest",
    },
    {
        "id": "social_media_statement",
        "query": (
            "An employee has been posting statements on social media presenting personal "
            "opinions as official company positions about a pending product recall, without "
            "authorization to speak for the company."
        ),
        "expected_class": "policy_only",
    },
    # ── uncovered: neither corpus addresses it ────────────────────────────────
    {
        "id": "wifi_bandwidth",
        "query": (
            "The office Wi-Fi has been slow for two weeks; someone might be using too much "
            "bandwidth for personal streaming."
        ),
        "expected_class": "uncovered",
    },
    {
        "id": "parking_dispute",
        "query": (
            "A colleague keeps parking in my assigned parking spot despite repeated notes, "
            "and facilities management has not responded to my complaints."
        ),
        "expected_class": "uncovered",
    },
]
