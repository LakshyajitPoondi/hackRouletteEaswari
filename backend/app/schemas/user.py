from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.models.user import Role


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: EmailStr
    role: Role
    is_active: bool
    created_at: datetime
    updated_at: datetime


class UserCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    password: str = Field(min_length=12, max_length=128)
    role: Role

    @field_validator("name")
    @classmethod
    def nonempty_name(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Name is required")
        return value

    @field_validator("password")
    @classmethod
    def nonblank_password(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Password cannot be blank")
        return value


class UserUpdate(BaseModel):
    role: Role | None = None
    is_active: bool | None = None
