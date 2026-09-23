from typing import Annotated

import jwt
from fastapi import Cookie, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth.security import COOKIE_NAME, decode_token
from app.db.session import get_db
from app.models.user import Role, User


def current_user(
    db: Annotated[Session, Depends(get_db)],
    token: Annotated[str | None, Cookie(alias=COOKIE_NAME)] = None,
) -> User:
    if not token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Authentication required")
    try:
        user_id = decode_token(token)
    except (jwt.PyJWTError, ValueError, TypeError):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired session") from None
    user = db.get(User, user_id)
    if user is None or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired session")
    return user


def require_role(*roles: Role):
    def check(user: Annotated[User, Depends(current_user)]) -> User:
        if user.role not in roles:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Insufficient permissions")
        return user

    return check
