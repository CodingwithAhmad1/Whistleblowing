"""Core prompt building logic."""

from typing import Any
import logging

from ..question_processors.report_utils import has_value
from .formats import format_for_provider

logger = logging.getLogger(__name__)

REPORT_FIELDS = [
    {"key": "organization_tier", "label": "Organization / Tier"},
    {"key": "country", "label": "Country"},
    {"key": "incident_location", "label": "Location where incident occurred"},
    {"key": "is_employee", "label": "Are you an employee of the organization (yes or no)"},
    {"key": "wish_anonymous", "label": "Do you wish to remain anonymous (yes or no)"},
    {"key": "reporter_first_name", "label": "Reporter first name"},
    {"key": "reporter_last_name", "label": "Reporter last name"},
    {"key": "reporter_phone_code", "label": "Reporter phone country code (e.g. +1, +44)"},
    {"key": "reporter_phone", "label": "Reporter phone number"},
    {"key": "reporter_email", "label": "Reporter email address"},
    {"key": "best_time_contact", "label": "Best time for communication"},
    {"key": "person_1_first", "label": "Person 1 first name"},
    {"key": "person_1_last", "label": "Person 1 last name"},
    {"key": "person_1_title", "label": "Person 1 title"},
    {"key": "person_2_first", "label": "Person 2 first name"},
    {"key": "person_2_last", "label": "Person 2 last name"},
    {"key": "person_2_title", "label": "Person 2 title"},
    {"key": "person_3_first", "label": "Person 3 first name"},
    {"key": "person_3_last", "label": "Person 3 last name"},
    {"key": "person_3_title", "label": "Person 3 title"},
    {"key": "person_4_first", "label": "Person 4 first name"},
    {"key": "person_4_last", "label": "Person 4 last name"},
    {"key": "person_4_title", "label": "Person 4 title"},
    {"key": "person_5_first", "label": "Person 5 first name"},
    {"key": "person_5_last", "label": "Person 5 last name"},
    {"key": "person_5_title", "label": "Person 5 title"},
    {"key": "person_6_first", "label": "Person 6 first name"},
    {"key": "person_6_last", "label": "Person 6 last name"},
    {"key": "person_6_title", "label": "Person 6 title"},
    {"key": "person_7_first", "label": "Person 7 first name"},
    {"key": "person_7_last", "label": "Person 7 last name"},
    {"key": "person_7_title", "label": "Person 7 title"},
    {"key": "person_8_first", "label": "Person 8 first name"},
    {"key": "person_8_last", "label": "Person 8 last name"},
    {"key": "person_8_title", "label": "Person 8 title"},
    {"key": "person_9_first", "label": "Person 9 first name"},
    {"key": "person_9_last", "label": "Person 9 last name"},
    {"key": "person_9_title", "label": "Person 9 title"},
    {"key": "person_10_first", "label": "Person 10 first name"},
    {"key": "person_10_last", "label": "Person 10 last name"},
    {"key": "person_10_title", "label": "Person 10 title"},
    {"key": "supervisor_involved", "label": "Supervisor or management involved (yes, no, do_not_know, do_not_wish)"},
    {"key": "supervisor_who", "label": "If yes, who is the supervisor or management involved"},
    {"key": "management_aware", "label": "Is management aware of this problem (yes, no, do_not_know, do_not_wish)"},
    {"key": "general_nature", "label": "General nature of matter"},
    {"key": "where_occurred", "label": "Where incident occurred"},
    {"key": "when_occurred", "label": "When incident occurred"},
    {"key": "duration", "label": "How long problem has been going on (once, one_week, 1_to_3_months, 3_months_to_a_year, more_than_a_year, don_t_know)"},
    {"key": "how_aware", "label": "How you became aware of this violation (it_happened_to_me, i_observed_it, i_heard_it, told_by_coworker, told_by_outside, overheard_it, accidentally_found_document, other)"},
    {"key": "how_aware_other", "label": "How you became aware (other)"},
    {"key": "persons_concealing", "label": "Persons concealing / steps taken"},
    {"key": "full_details_q1", "label": "Please describe what happened in your own words."},
    {"key": "full_details_q2", "label": "Answer to AI-generated follow-up question"},
    {"key": "full_details_q3", "label": "Answer to 2nd AI-generated follow-up question"},
    {"key": "policy_quote_matched", "label": "Matched policy quote from rules book"},
]


def get_filled_report_fields(report_data: dict[str, Any]) -> list[dict[str, str]]:
    """Return REPORT_FIELDS entries where the key has a non-empty value."""
    return [f for f in REPORT_FIELDS if has_value(report_data.get(f["key"]))]


def get_unfilled_report_fields(report_data: dict[str, Any]) -> list[dict[str, str]]:
    """Return REPORT_FIELDS entries where the key is missing or empty."""
    return [f for f in REPORT_FIELDS if not has_value(report_data.get(f["key"]))]


def build_system_prompt(report_data: dict[str, Any]) -> str:
    """Build system prompt based on current report state."""
    filled_fields = get_filled_report_fields(report_data)
    unfilled_fields = get_unfilled_report_fields(report_data)
    field_list = "\n".join([f"- {f['key']}: {f['label']}" for f in REPORT_FIELDS])
    filled_keys = ", ".join([f["key"] for f in filled_fields]) or "none"
    unfilled_keys = ", ".join([f["key"] for f in unfilled_fields]) or "none"
    if not unfilled_fields:
        completion_msg = "All fields are filled. Thank the user and confirm the report is ready."
    else:
        completion_msg = f"Continue gathering information. Prioritize unfilled fields: {unfilled_keys}."

    return f"""You are a professional, empathetic whistleblowing report assistant. Your job is to ask ONE question at a time and extract information from the user's answers.
Be concise. Stay on the whistleblowing report topic. Do not go off-topic. One question at a time.

Report fields (use these exact keys in JSON):
{field_list}

Current Status:
- Filled: {filled_keys}
- Not yet filled: {unfilled_keys}

{completion_msg}

Rules for Interaction:
1. Ask ONE question at a time. Wait for the user's answer.
2. When the user provides information for a field, output JSON in this format:
   {{"data": {{"field_key": "value"}}}}
   - "data": Field updates (only include when extracting new/updated information from the user's reply)
3. For is_employee and wish_anonymous use "yes" or "no". For management_aware and supervisor_involved use "yes", "no", "do_not_know", or "do_not_wish".
4. Keep questions concise and professional. Do not repeat the user's answer back at length.
5. Be empathetic and supportive - this is a sensitive situation.

Examples:
User: "Something bad happened"
You: {{"data": {{"general_nature": "Something bad happened"}}}}
That's a start. Can you be more specific about what type of issue this is?

User: "Financial fraud involving fake expense reports"
You: {{"data": {{"general_nature": "Financial fraud involving fake expense reports"}}}}
Thank you for that detail. When did you first become aware of this issue?

Priority: Focus on unfilled fields first ({unfilled_keys})."""


def build_chat_prompt(
    system_prompt: str,
    conversation_history: list[dict[str, str]],
    max_history: int = 20,
    provider_name: str | None = None,
) -> str:
    """Build full prompt with history, formatted for Gemini."""
    return format_for_provider(system_prompt, conversation_history, provider_name)
