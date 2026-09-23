from typing import Annotated

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.auth.dependencies import current_user, require_role
from app.db.session import get_db
from app.models.user import Role, User
from app.schemas.participant import BulkResult, BulkUpdate, ParticipantFilters, ParticipantPage, ParticipantRead, ParticipantUpdate
from app.services import participants as service

router = APIRouter(prefix="/api/participants", tags=["participants"])
AllAdmins = Annotated[User, Depends(current_user)]


@router.get("", response_model=ParticipantPage)
def list_participants(
    db: Annotated[Session, Depends(get_db)],
    _: AllAdmins,
    filters: Annotated[ParticipantFilters, Depends()],
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 50,
):
    return service.list_participants(db, filters, page, page_size)


@router.get("/options")
def filter_options(db: Annotated[Session, Depends(get_db)], _: AllAdmins):
    return service.filter_options(db)


@router.get("/export")
def export_participants(db: Annotated[Session, Depends(get_db)], filters: Annotated[ParticipantFilters, Depends()], _: Annotated[User, Depends(require_role(Role.SUPER_ADMIN, Role.ADMIN))]):
    return StreamingResponse(service.export_rows(db, filters), media_type="text/csv; charset=utf-8", headers={"Content-Disposition": 'attachment; filename="tech-roulette-participants.csv"'})


@router.post("/bulk-update", response_model=BulkResult)
def bulk_update(payload: BulkUpdate, db: Annotated[Session, Depends(get_db)], actor: AllAdmins):
    return {"updated_count": service.bulk_update(db, payload, actor)}


@router.get("/{participant_id}", response_model=ParticipantRead)
def get_participant(participant_id: int, db: Annotated[Session, Depends(get_db)], _: AllAdmins):
    return service.get_participant(db, participant_id)


@router.patch("/{participant_id}", response_model=ParticipantRead)
def update_participant(participant_id: int, payload: ParticipantUpdate, db: Annotated[Session, Depends(get_db)], actor: AllAdmins):
    return service.update_participant(db, participant_id, payload, actor)
