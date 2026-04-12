"""Pydantic schemas for report structure. Ready for future DB persistence."""

from typing import Literal, Optional

from pydantic import BaseModel


class ReportCreate(BaseModel):
    """Report data structure aligned with UI form fields."""

    # Organization & Context
    organization_tier: Optional[str] = None
    country: Optional[str] = None
    incident_location: Optional[str] = None

    # Reporter Preferences
    is_employee: Optional[Literal["yes", "no"]] = None
    wish_anonymous: Optional[Literal["yes", "no"]] = None
    reporter_first_name: Optional[str] = None
    reporter_last_name: Optional[str] = None
    reporter_phone_code: Optional[str] = None
    reporter_phone: Optional[str] = None
    reporter_email: Optional[str] = None
    best_time_contact: Optional[str] = None

    # Identifying Persons and Management
    person_1_first: Optional[str] = None
    person_1_last: Optional[str] = None
    person_1_title: Optional[str] = None
    person_2_first: Optional[str] = None
    person_2_last: Optional[str] = None
    person_2_title: Optional[str] = None
    person_3_first: Optional[str] = None
    person_3_last: Optional[str] = None
    person_3_title: Optional[str] = None
    person_4_first: Optional[str] = None
    person_4_last: Optional[str] = None
    person_4_title: Optional[str] = None
    person_5_first: Optional[str] = None
    person_5_last: Optional[str] = None
    person_5_title: Optional[str] = None
    person_6_first: Optional[str] = None
    person_6_last: Optional[str] = None
    person_6_title: Optional[str] = None
    person_7_first: Optional[str] = None
    person_7_last: Optional[str] = None
    person_7_title: Optional[str] = None
    person_8_first: Optional[str] = None
    person_8_last: Optional[str] = None
    person_8_title: Optional[str] = None
    person_9_first: Optional[str] = None
    person_9_last: Optional[str] = None
    person_9_title: Optional[str] = None
    person_10_first: Optional[str] = None
    person_10_last: Optional[str] = None
    person_10_title: Optional[str] = None
    supervisor_involved: Optional[Literal["yes", "no", "do_not_know", "do_not_wish"]] = None
    supervisor_who: Optional[str] = None
    management_aware: Optional[Literal["yes", "no", "do_not_know", "do_not_wish"]] = None

    # Incident
    general_nature: Optional[str] = None
    where_occurred: Optional[str] = None
    when_occurred: Optional[str] = None
    duration: Optional[str] = None
    how_aware: Optional[str] = None
    how_aware_other: Optional[str] = None
    full_details_q1: Optional[str] = None
    sequence_of_events: Optional[str] = None
    evidence_description: Optional[str] = None
    full_details_q2: Optional[str] = None
    full_details_q2_question: Optional[str] = None
    full_details_gap2: Optional[str] = None
    full_details_gap2_question: Optional[str] = None
    full_details_q3: Optional[str] = None
    full_details_q3_question: Optional[str] = None
    policy_quote_matched: Optional[str] = None
    policy_section_matched: Optional[str] = None
    constructed_sentence: Optional[str] = None
    persons_concealing: Optional[str] = None


class Report(ReportCreate):
    """Report with optional id for future DB."""

    id: Optional[str] = None
