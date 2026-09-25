from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.auth.security import hash_password
from app.models.user import Role, User
from app.schemas.user import UserCreate, UserUpdate


def list_users(db: Session) -> list[User]:
    return list(db.scalars(select(User).order_by(User.created_at.desc(), User.id.desc())))


def create_user(db: Session, payload: UserCreate) -> User:
    email = str(payload.email).lower()
    if db.scalar(select(User.id).where(User.email == email)):
        raise HTTPException(status.HTTP_409_CONFLICT, "Email already exists")
    user = User(name=payload.name.strip(), email=email, password_hash=hash_password(payload.password), role=payload.role)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def update_user(db: Session, user_id: int, payload: UserUpdate, actor: User) -> User:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    if payload.role is None and payload.is_active is None:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Provide a change")
    if user.id == actor.id and (payload.is_active is False or (payload.role is not None and payload.role != Role.SUPER_ADMIN)):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "You cannot remove your own access")
    removing_super_admin = user.role == Role.SUPER_ADMIN and (payload.role not in (None, Role.SUPER_ADMIN) or payload.is_active is False)
    if removing_super_admin and user.is_active:
        count = db.scalar(select(func.count()).select_from(User).where(User.role == Role.SUPER_ADMIN, User.is_active.is_(True)))
        if count <= 1:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "At least one active super admin is required")
    if payload.role is not None:
        user.role = payload.role
    if payload.is_active is not None:
        user.is_active = payload.is_active
    db.commit()
    db.refresh(user)
    return user


def disable_user(db: Session, user_id: int, actor: User) -> None:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    if user.id == actor.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "You cannot disable your own account")
    if user.role == Role.SUPER_ADMIN and user.is_active:
        count = db.scalar(select(func.count()).select_from(User).where(User.role == Role.SUPER_ADMIN, User.is_active.is_(True)))
        if count <= 1:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "At least one active super admin is required")
    user.is_active = False
    db.commit()
