from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.dependencies import current_user
from app.auth.security import COOKIE_NAME, hash_password, make_token, verify_password
from app.core.config import get_settings
from app.db.session import get_db
from app.models.user import User
from app.schemas.auth import ChangePasswordRequest, LoginRequest, LoginResponse
from app.schemas.user import UserRead

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest, response: Response, db: Annotated[Session, Depends(get_db)]):
    user = db.scalar(select(User).where(User.email == str(payload.email).lower()))
    if user is None or not verify_password(payload.password, user.password_hash) or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid credentials")
    settings = get_settings()
    response.set_cookie(COOKIE_NAME, make_token(user.id), max_age=settings.access_token_minutes * 60, httponly=True, secure=settings.cookie_secure, samesite="lax", path="/")
    return {"user": user}


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response):
    response.delete_cookie(COOKIE_NAME, path="/", secure=get_settings().cookie_secure, httponly=True, samesite="lax")


@router.get("/me", response_model=UserRead)
def me(user: Annotated[User, Depends(current_user)]):
    return user


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
def change_password(payload: ChangePasswordRequest, db: Annotated[Session, Depends(get_db)], user: Annotated[User, Depends(current_user)]):
    if not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Current password is incorrect")
    if payload.new_password != payload.confirm_new_password:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "New passwords do not match")
    if len(payload.new_password) < 12:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Password is too short (minimum 12 characters)")
    if len(payload.new_password) > 128:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Password is too long (maximum 128 characters)")
    if not payload.new_password.strip():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Password cannot be blank")
    user.password_hash = hash_password(payload.new_password)
    db.commit()
