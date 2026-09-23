import argparse
import sys

from sqlalchemy import select
from pydantic import EmailStr, TypeAdapter, ValidationError

from app.auth.security import hash_password
from app.core.config import get_settings
from app.db.session import SessionLocal
from app.models.user import Role, User


def main() -> None:
    parser = argparse.ArgumentParser(description="Create the initial super admin from environment variables")
    parser.add_argument("--name", default="Super Admin")
    parser.add_argument(
        "--reset-existing",
        action="store_true",
        help="Reset the configured initial admin's password if that user already exists",
    )
    args = parser.parse_args()
    settings = get_settings()
    email = (settings.initial_admin_email or "").strip().lower()
    password = settings.initial_admin_password or ""
    if not email or len(password) < 12 or password.lower() in {"replace-with-a-strong-unique-password", "password123456"}:
        sys.exit("Set INITIAL_ADMIN_EMAIL and a unique INITIAL_ADMIN_PASSWORD of at least 12 characters")
    try:
        email = str(TypeAdapter(EmailStr).validate_python(email))
    except ValidationError:
        raise SystemExit("INITIAL_ADMIN_EMAIL must be a valid email address") from None
    with SessionLocal.begin() as db:
        user = db.scalar(select(User).where(User.email == email))
        if user:
            if not args.reset_existing:
                sys.exit("User already exists; use --reset-existing to reset its password")
            user.password_hash = hash_password(password)
            action = "Reset password for"
        else:
            db.add(User(name=args.name.strip(), email=email, password_hash=hash_password(password), role=Role.SUPER_ADMIN))
            action = "Created super admin"
    print(f"{action} {email}")


if __name__ == "__main__":
    main()
