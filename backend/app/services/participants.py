import csv
import io
from math import ceil

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.user import Role, User
from app.schemas.participant import BulkAction, BulkUpdate, ParticipantFilters, ParticipantUpdate
from app.services.google_sheets import SheetParticipant, participant_source


def _matches(person: SheetParticipant, filters: ParticipantFilters) -> bool:
    if filters.search:
        term = filters.search.strip().casefold()
        if not any(term in (value or "").casefold() for value in (person.full_name, person.email, person.college, person.team_name)):
            return False
    return not (
        filters.attendance is not None and person.attendance_status != filters.attendance.value
        or filters.certificate_eligible is not None and person.certificate_eligible != filters.certificate_eligible
        or filters.college and person.college != filters.college
        or filters.year and person.year != filters.year
        or filters.is_disqualified is not None and person.is_disqualified != filters.is_disqualified
    )


def filtered_people(filters: ParticipantFilters) -> list[SheetParticipant]:
    people = [person for person in participant_source().list() if _matches(person, filters)]
    keys = {"name": lambda p: p.full_name.casefold(), "registration_date": lambda p: p.registration_timestamp,
            "college": lambda p: (p.college or "").casefold(), "team": lambda p: (p.team_name or "").casefold()}
    return sorted(people, key=keys[filters.sort_by], reverse=filters.sort_dir == "desc")


def serialize(person: SheetParticipant) -> dict:
    return {**person.__dict__, "registration_source": "GOOGLE_FORM",
            "created_at": person.registration_timestamp, "updated_at": person.registration_timestamp}


def list_participants(db: Session, filters: ParticipantFilters, page: int, page_size: int):
    people = filtered_people(filters); start = (page - 1) * page_size
    return {"items": [serialize(p) for p in people[start:start + page_size]], "page": page,
            "page_size": page_size, "total": len(people), "total_pages": ceil(len(people) / page_size)}


def get_participant(db: Session, participant_id: int):
    return serialize(participant_source().get(participant_id))


def update_participant(db: Session, participant_id: int, payload: ParticipantUpdate, actor: User):
    fields = payload.model_fields_set
    if not fields:
        raise HTTPException(422, "Provide a change")
    if actor.role == Role.STAFF and fields - {"attendance_status"}:
        raise HTTPException(403, "Staff may update attendance only")
    return serialize(participant_source().update(participant_id, payload.model_dump(include=fields)))


def bulk_update(db: Session, payload: BulkUpdate, actor: User) -> int:
    if actor.role == Role.STAFF and payload.action not in {BulkAction.MARK_PRESENT, BulkAction.MARK_ABSENT}:
        raise HTTPException(403, "Staff may update attendance only")
    field, value = {BulkAction.MARK_PRESENT: ("attendance_status", "PRESENT"), BulkAction.MARK_ABSENT: ("attendance_status", "ABSENT"),
                    BulkAction.MARK_ELIGIBLE: ("certificate_eligible", True), BulkAction.MARK_INELIGIBLE: ("certificate_eligible", False)}[payload.action]
    source = participant_source()
    for participant_id in payload.participant_ids:
        source.update(participant_id, {field: value})
    return len(payload.participant_ids)


def filter_options(db: Session) -> dict:
    people = participant_source().list()
    return {"colleges": sorted({p.college for p in people if p.college}), "years": sorted({p.year for p in people if p.year})}


def dashboard_metrics(db: Session) -> dict:
    people = participant_source().list()
    return {"registrations": len(people), "present": sum(p.attendance_status == "PRESENT" for p in people),
            "absent": sum(p.attendance_status == "ABSENT" for p in people), "registered": sum(p.attendance_status == "REGISTERED" for p in people),
            "certificate_eligible": sum(p.certificate_eligible and not p.is_disqualified for p in people),
            "teams": len({p.team_name.casefold() for p in people if p.team_name})}


def safe_csv(value) -> str:
    text = "" if value is None else str(value)
    return "'" + text if text.lstrip().startswith(("=", "+", "-", "@")) else text


def export_rows(db: Session, filters: ParticipantFilters):
    buffer = io.StringIO(); writer = csv.writer(buffer)
    writer.writerow(["Name", "Email", "Phone", "College", "Department", "Year", "Team", "Attendance", "Certificate Eligible", "Disqualified", "Registration Date"])
    yield buffer.getvalue(); buffer.seek(0); buffer.truncate(0)
    for person in filtered_people(filters):
        writer.writerow([safe_csv(v) for v in (person.full_name, person.email, person.phone, person.college, person.department, person.year,
            person.team_name, person.attendance_status, person.certificate_eligible, person.is_disqualified, person.registration_timestamp.isoformat())])
        yield buffer.getvalue(); buffer.seek(0); buffer.truncate(0)
