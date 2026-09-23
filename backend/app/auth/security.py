from datetime import datetime, timedelta, timezone

import jwt
from pwdlib import PasswordHash

from app.core.config import get_settings

password_hash = PasswordHash.recommended()
ALGORITHM = "HS256"
COOKIE_NAME = "hackroulette_admin"


def hash_password(password: str) -> str:
    return password_hash.hash(password)


def verify_password(password: str, hashed: str) -> bool:
    return password_hash.verify(password, hashed)


def make_token(user_id: int) -> str:
    now = datetime.now(timezone.utc)
    return jwt.encode(
        {"sub": str(user_id), "iat": now, "exp": now + timedelta(minutes=get_settings().access_token_minutes)},
        get_settings().jwt_secret,
        algorithm=ALGORITHM,
    )


def decode_token(token: str) -> int:
    claims = jwt.decode(token, get_settings().jwt_secret, algorithms=[ALGORITHM], options={"require": ["sub", "exp", "iat"]})
    return int(claims["sub"])
