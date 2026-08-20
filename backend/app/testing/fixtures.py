"""Test fixtures for the AI pipeline diagnostics."""

TEST_FIXTURES: list[dict] = [
    {
        "id": "clear_fraud",
        "label": "Clear fraud case",
        "description": "A detailed bribery/expense fraud report that should match anti-corruption policy.",
        "form_data": {
            "general_nature": "Financial fraud",
            "where_occurred": "Accounting department, Building A",
            "when_occurred": "January 2026",
            "duration": "3_months_to_a_year",
            "how_aware": "accidentally_found_document",
            "organization_tier": "Corporate",
            "country": "United States",
            "incident_location": "Minneapolis headquarters",
            "full_details_q1": (
                "I discovered that my supervisor, John Smith, has been submitting "
                "fraudulent expense reports totaling over $50,000 over the past six months. "
                "I found duplicate receipts in the shared drive on January 15, 2026. "
                "The receipts were for meals and travel that never took place. "
                "I also noticed discrepancies in the monthly reconciliation reports "
                "that were signed off by the same supervisor."
            ),
            "full_details_q2": (
                "The duplicate receipts are stored in the Q4 shared folder under "
                "'Expense Reports - Smith'. I also noticed that the approved amounts "
                "exactly match round numbers, which seems suspicious. The finance team "
                "appears unaware of these discrepancies."
            ),
            "supervisor_involved": "yes",
            "management_aware": "no",
        },
        "expected": {
            "intake_layer1_extraction": {
                "should_pass": True,
            },
            "intake_layer2_gaps": {
                "should_pass": True,
                # Two-pass Layer-1 infers examples/impact/timeline; fewer spurious gaps remain.
                "max_gaps": 1,
            },
            "intake_layer3_questions": {
                "should_pass": True,
            },
            "constructed_sentence": {
                "should_pass": True,
                "min_length": 20,
            },
            "rag_retrieval": {
                "should_pass": True,
                "must_have_quote": True,
            },
            "coverage_classification": {
                "should_pass": True,
                "expected_classification": "covered",
            },
        },
    },
    {
        "id": "ambiguous_harassment",
        "label": "Ambiguous workplace concern",
        "description": "A vague complaint that tests low-confidence matching.",
        "form_data": {
            "general_nature": "Workplace behavior",
            "where_occurred": "Main office",
            "organization_tier": "Regional",
            "country": "Germany",
            "full_details_q1": (
                "Something is wrong at work. My colleague has been acting strange "
                "and I feel uncomfortable. The atmosphere has changed."
            ),
            "full_details_q2": "It has been going on for a few weeks.",
        },
        "expected": {
            "intake_layer1_extraction": {
                "should_pass": True,
            },
            "intake_layer2_gaps": {
                "should_pass": True,
                "min_gaps": 1,
            },
            "intake_layer3_questions": {
                "should_pass": True,
            },
            "constructed_sentence": {
                "should_pass": True,
                "min_length": 10,
            },
            "rag_retrieval": {
                "should_pass": True,
                "must_have_quote": False,
            },
        },
    },
    {
        "id": "off_topic_edge",
        "label": "Off-topic edge case",
        "description": "A report about something not covered by the policy document.",
        "form_data": {
            "general_nature": "IT issue",
            "full_details_q1": (
                "The office Wi-Fi has been slow for the past two weeks. "
                "I think someone might be using too much bandwidth."
            ),
        },
        "expected": {
            "intake_layer1_extraction": {
                "should_pass": True,
            },
            "intake_layer2_gaps": {
                "should_pass": True,
            },
            "constructed_sentence": {
                "should_pass": True,
            },
            "rag_retrieval": {
                "should_pass": True,
                "must_have_quote": False,
            },
            "coverage_classification": {
                "should_pass": True,
                "expected_classification": "uncovered",
            },
        },
    },
    {
        "id": "minimal_no_q1",
        "label": "Minimal report (no Q1)",
        "description": "Edge case: only basic fields, no narrative text. Tests graceful degradation.",
        "form_data": {
            "general_nature": "Safety concern",
            "where_occurred": "Factory floor",
        },
        "expected": {
            "intake_layer1_extraction": {
                "should_pass": False,
            },
            "intake_layer2_gaps": {
                "should_pass": False,
            },
            "intake_layer3_questions": {
                "should_pass": False,
            },
            "constructed_sentence": {
                "should_pass": True,
                "min_length": 5,
            },
            "rag_retrieval": {
                "should_pass": True,
            },
        },
    },
]
