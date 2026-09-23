import enum
import re
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class AttendanceStatus(str, enum.Enum):
    REGISTERED = "REGISTERED"
    PRESENT = "PRESENT"
    ABSENT = "ABSENT"


class RegistrationSource(str, enum.Enum):
    GOOGLE_FORM = "GOOGLE_FORM"


def clean_text(value: str | None) -> str | None:
    return " ".join(value.split()) if value is not None else None


class ParticipantRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    full_name: str
    email: EmailStr
    phone: str | None
    college: str | None
    department: str | None
    year: str | None
    team_name: str | None
    registration_source: RegistrationSource
    registration_timestamp: datetime
    attendance_status: AttendanceStatus
    certificate_eligible: bool
    is_disqualified: bool
    notes: str | None
    created_at: datetime
    updated_at: datetime


class ParticipantUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    full_name: str | None = Field(default=None, min_length=1, max_length=160)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=32)
    college: str | None = Field(default=None, max_length=160)
    department: str | None = Field(default=None, max_length=160)
    year: str | None = Field(default=None, max_length=32)
    team_name: str | None = Field(default=None, max_length=160)
    attendance_status: AttendanceStatus | None = None
    certificate_eligible: bool | None = None
    is_disqualified: bool | None = None
    notes: str | None = Field(default=None, max_length=5000)

    @field_validator("full_name", "phone", "college", "department", "year", "team_name", mode="before")
    @classmethod
    def normalize_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        if not isinstance(value, str):
            raise ValueError("Must be text")
        return clean_text(value)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: EmailStr | None) -> str | None:
        return str(value).lower() if value is not None else None

    @field_validator("phone")
    @classmethod
    def valid_phone(cls, value: str | None) -> str | None:
        if value and not re.fullmatch(r"[+0-9 ()-]{7,32}", value):
            raise ValueError("Invalid phone number")
        return value or None


class BulkAction(str, enum.Enum):
    MARK_PRESENT = "MARK_PRESENT"
    MARK_ABSENT = "MARK_ABSENT"
    MARK_ELIGIBLE = "MARK_ELIGIBLE"
    MARK_INELIGIBLE = "MARK_INELIGIBLE"


class BulkUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    participant_ids: list[int] = Field(min_length=1, max_length=500)
    action: BulkAction

    @field_validator("participant_ids")
    @classmethod
    def unique_ids(cls, value: list[int]) -> list[int]:
        if any(item <= 0 for item in value):
            raise ValueError("Participant IDs must be positive")
        return list(dict.fromkeys(value))


class ParticipantFilters(BaseModel):
    search: str | None = Field(default=None, max_length=160)
    attendance: AttendanceStatus | None = None
    certificate_eligible: bool | None = None
    college: str | None = Field(default=None, max_length=160)
    year: str | None = Field(default=None, max_length=32)
    is_disqualified: bool | None = None
    sort_by: Literal["name", "registration_date", "college", "team"] = "registration_date"
    sort_dir: Literal["asc", "desc"] = "desc"


class ParticipantPage(BaseModel):
    items: list[ParticipantRead]
    page: int
    page_size: int
    total: int
    total_pages: int


class BulkResult(BaseModel):
    updated_count: int
