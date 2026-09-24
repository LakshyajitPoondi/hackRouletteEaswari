from typing import Annotated, Literal

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.auth.dependencies import current_user, require_role
from app.db.session import get_db
from app.models.participant import Participant
from app.models.user import Role, User
from app.services import csv_participants
from app.services.db_participants import get_person, list_people

router = APIRouter(prefix="/api/participants", tags=["participants"])
Database = Annotated[Session, Depends(get_db)]
Reader = Annotated[User, Depends(current_user)]
Manager = Annotated[User, Depends(require_role(Role.SUPER_ADMIN, Role.ADMIN))]


@router.get("")
def participants(db: Database, _: Reader, search: str = Query(default="", max_length=160),
                 sort_by: Literal["name", "email", "team_name", "college", "created_at"] = "name",
                 sort_dir: Literal["asc", "desc"] = "asc", page: int = Query(default=1, ge=1),
                 page_size: int = Query(default=50, ge=1, le=500)):
    return list_people(db, search, sort_by, sort_dir, page, page_size)


@router.get("/all")
def all_participants(db: Database, _: Manager):
    return list(db.scalars(select(Participant).order_by(Participant.name, Participant.id)))


@router.post("/import/preview")
async def preview_import(db: Database, _: Manager, file: UploadFile = File(...)):
    data = await file.read(csv_participants.MAX_CSV_BYTES + 1)
    return csv_participants.preview(db, data)


@router.post("/import")
async def import_participants(db: Database, _: Manager, digest: str = Form(...), file: UploadFile = File(...)):
    data = await file.read(csv_participants.MAX_CSV_BYTES + 1)
    return csv_participants.import_rows(db, data, digest)


@router.delete("/clear", status_code=204)
def clear_participants(db: Database, _: Manager):
    db.execute(delete(Participant))
    db.commit()


@router.get("/{participant_id}")
def participant(participant_id: int, db: Database, _: Reader):
    return get_person(db, participant_id)


@router.delete("/{participant_id}", status_code=204)
def delete_participant(participant_id: int, db: Database, _: Manager):
    person = get_person(db, participant_id)
    db.delete(person)
    db.commit()
