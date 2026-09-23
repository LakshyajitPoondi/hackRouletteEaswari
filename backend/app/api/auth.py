from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.dependencies import current_user
from app.auth.security import COOKIE_NAME, make_token, verify_password
from app.core.config import get_settings
from app.db.session import get_db
from app.models.user import User
from app.schemas.auth import LoginRequest, LoginResponse
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
