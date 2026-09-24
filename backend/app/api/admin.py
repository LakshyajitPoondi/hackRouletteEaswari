from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.auth.dependencies import current_user, require_role
from app.db.session import get_db
from app.models.user import Role, User
from app.schemas.user import UserCreate, UserRead, UserUpdate
from app.services import users as user_service
from app.models.participant import Participant
from app.models.email import EmailCampaign, EmailDelivery, EmailTemplate
from sqlalchemy import func, select

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/dashboard")
def dashboard(db: Annotated[Session, Depends(get_db)], _: Annotated[User, Depends(current_user)]):
    metrics = {"registrations": db.scalar(select(func.count()).select_from(Participant)) or 0}
    metrics.update({
        "certificates_sent": db.scalar(select(func.count()).select_from(EmailDelivery).join(EmailCampaign).where(EmailDelivery.status == "SENT", EmailCampaign.attach_certificate.is_(True))) or 0,
        "failed_emails": db.scalar(select(func.count()).select_from(EmailDelivery).where(EmailDelivery.status == "FAILED")) or 0,
        "email_templates": db.scalar(select(func.count()).select_from(EmailTemplate)) or 0,
        "campaigns": db.scalar(select(func.count()).select_from(EmailCampaign)) or 0,
        "admin_users": db.scalar(select(func.count()).select_from(User)) or 0,
    })
    return {"is_placeholder": False, "metrics": metrics}


@router.get("/users", response_model=list[UserRead])
def list_users(db: Annotated[Session, Depends(get_db)], _: Annotated[User, Depends(require_role(Role.SUPER_ADMIN))]):
    return user_service.list_users(db)


@router.post("/users", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def create_user(payload: UserCreate, db: Annotated[Session, Depends(get_db)], _: Annotated[User, Depends(require_role(Role.SUPER_ADMIN))]):
    return user_service.create_user(db, payload)


@router.patch("/users/{user_id}", response_model=UserRead)
def update_user(user_id: int, payload: UserUpdate, db: Annotated[Session, Depends(get_db)], actor: Annotated[User, Depends(require_role(Role.SUPER_ADMIN))]):
    return user_service.update_user(db, user_id, payload, actor)
