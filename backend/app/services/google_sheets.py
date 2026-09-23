"""Google Sheets participant source of truth.

The first row is treated as headers and each following row as one participant.
Form columns are discovered by common header aliases; optional operations columns
can be appended to the response sheet and are updated in place.
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from functools import lru_cache
from urllib.parse import quote

import httpx
from fastapi import HTTPException

from app.core.config import get_settings

ALIASES = {
    "timestamp": ("timestamp", "registration timestamp", "submitted at"),
    "full_name": ("full name", "name", "participant name"),
    "email": ("email address", "email", "participant email"),
    "phone": ("phone number", "phone", "mobile number"),
    "college": ("college name", "college", "institution"),
    "department": ("department", "dept"),
    "year": ("year", "year of study"),
    "team_name": ("team name", "team"),
    "attendance_status": ("attendance status", "attendance"),
    "certificate_eligible": ("certificate eligible", "eligible"),
    "is_disqualified": ("disqualified", "is disqualified"),
    "notes": ("admin notes", "notes"),
}
WRITE_HEADERS = {
    "attendance_status": "Attendance Status",
    "certificate_eligible": "Certificate Eligible",
    "is_disqualified": "Disqualified",
    "notes": "Admin Notes",
}


def _norm(value: str) -> str:
    return re.sub(r"\s+", " ", value.strip().casefold())


def _truth(value: str, default: bool = False) -> bool:
    if not value.strip():
        return default
    return _norm(value) in {"1", "true", "yes", "y", "eligible"}


def _column(index: int) -> str:
    result = ""
    while index:
        index, remainder = divmod(index - 1, 26)
        result = chr(65 + remainder) + result
    return result


@dataclass
class SheetParticipant:
    id: int
    full_name: str
    email: str
    college: str | None = None
    phone: str | None = None
    department: str | None = None
    year: str | None = None
    team_name: str | None = None
    registration_timestamp: datetime = datetime(1970, 1, 1, tzinfo=timezone.utc)
    attendance_status: str = "REGISTERED"
    certificate_eligible: bool = True
    is_disqualified: bool = False
    notes: str | None = None

    @property
    def participant_key(self) -> str:
        return self.email.strip().casefold()

class GoogleSheetsParticipants:
    def __init__(self):
        settings = get_settings()
        self.spreadsheet_id = settings.google_sheets_spreadsheet_id
        self.range = settings.google_sheets_range
        self.service_json = settings.google_service_account_json
        self.api_key = settings.google_sheets_api_key
        self._credentials = None

    def _headers(self) -> dict[str, str]:
        if self.service_json:
            try:
                from google.auth.transport.requests import Request
                from google.oauth2 import service_account
                if self._credentials is None:
                    info = json.loads(self.service_json)
                    self._credentials = service_account.Credentials.from_service_account_info(
                        info, scopes=["https://www.googleapis.com/auth/spreadsheets"]
                    )
                if not self._credentials.valid:
                    self._credentials.refresh(Request())
                return {"Authorization": f"Bearer {self._credentials.token}"}
            except Exception as exc:
                raise HTTPException(503, f"Google Sheets credentials are invalid: {type(exc).__name__}") from None
        return {}

    def _request(self, method: str, range_name: str, *, values: list[list[str]] | None = None) -> dict:
        if not self.spreadsheet_id:
            raise HTTPException(503, "GOOGLE_SHEETS_SPREADSHEET_ID is not configured")
        encoded = quote(range_name, safe="")
        url = f"https://sheets.googleapis.com/v4/spreadsheets/{self.spreadsheet_id}/values/{encoded}"
        params = {"key": self.api_key} if self.api_key else None
        try:
            if method == "GET":
                response = httpx.get(url, headers=self._headers(), params=params, timeout=15)
            else:
                response = httpx.put(url, headers=self._headers(), params={**(params or {}), "valueInputOption": "RAW"}, json={"values": values}, timeout=15)
        except httpx.HTTPError:
            raise HTTPException(503, "Google Sheets is temporarily unavailable") from None
        if response.is_error:
            raise HTTPException(503, f"Google Sheets returned {response.status_code}")
        return response.json()

    def _rows(self) -> tuple[list[str], list[list[str]]]:
        values = self._request("GET", self.range).get("values", [])
        if not values:
            return [], []
        return values[0], values[1:]

    def list(self) -> list[SheetParticipant]:
        headers, rows = self._rows()
        normalized = {_norm(header): index for index, header in enumerate(headers)}
        mapping: dict[str, int] = {}
        for field, aliases in ALIASES.items():
            for alias in aliases:
                if alias in normalized:
                    mapping[field] = normalized[alias]
                    break
        if "full_name" not in mapping or "email" not in mapping:
            raise HTTPException(503, "Google Sheet must contain Full Name and Email Address columns")

        def cell(row: list[str], field: str) -> str:
            index = mapping.get(field, -1)
            return row[index].strip() if 0 <= index < len(row) else ""

        people: list[SheetParticipant] = []
        for row_number, row in enumerate(rows, start=2):
            name, email = cell(row, "full_name"), cell(row, "email").lower()
            if not name or not email:
                continue
            raw_time = cell(row, "timestamp")
            try:
                timestamp = datetime.fromisoformat(raw_time.replace("Z", "+00:00")) if raw_time else datetime(1970, 1, 1, tzinfo=timezone.utc)
            except ValueError:
                timestamp = datetime(1970, 1, 1, tzinfo=timezone.utc)
            if timestamp.tzinfo is None:
                timestamp = timestamp.replace(tzinfo=timezone.utc)
            attendance = cell(row, "attendance_status").upper() or "REGISTERED"
            if attendance not in {"REGISTERED", "PRESENT", "ABSENT"}:
                attendance = "REGISTERED"
            people.append(SheetParticipant(
                id=row_number, full_name=name, email=email, college=cell(row, "college") or None,
                phone=cell(row, "phone") or None, department=cell(row, "department") or None,
                year=cell(row, "year") or None, team_name=cell(row, "team_name") or None,
                registration_timestamp=timestamp, attendance_status=attendance,
                certificate_eligible=_truth(cell(row, "certificate_eligible"), True),
                is_disqualified=_truth(cell(row, "is_disqualified")), notes=cell(row, "notes") or None,
            ))
        return people

    def get(self, row_number: int) -> SheetParticipant:
        person = next((item for item in self.list() if item.id == row_number), None)
        if not person:
            raise HTTPException(404, "Participant not found")
        return person

    def update(self, row_number: int, changes: dict[str, object]) -> SheetParticipant:
        headers, _ = self._rows()
        sheet = self.range.split("!", 1)[0]
        normalized = {_norm(header): index for index, header in enumerate(headers)}
        updates: list[tuple[int, str]] = []
        for field, value in changes.items():
            aliases = ALIASES.get(field)
            if not aliases:
                continue
            index = next((normalized[a] for a in aliases if a in normalized), None)
            if index is None:
                if field not in WRITE_HEADERS:
                    raise HTTPException(422, f"The Google Sheet has no column for {field}")
                index = len(headers)
                headers.append(WRITE_HEADERS[field])
                normalized[_norm(WRITE_HEADERS[field])] = index
                self._request("PUT", f"{sheet}!{_column(index + 1)}1", values=[[WRITE_HEADERS[field]]])
            if isinstance(value, bool):
                value = "TRUE" if value else "FALSE"
            elif hasattr(value, "value"):
                value = value.value
            updates.append((index, "" if value is None else str(value)))
        for index, value in updates:
            self._request("PUT", f"{sheet}!{_column(index + 1)}{row_number}", values=[[value]])
        return self.get(row_number)


@lru_cache
def participant_source() -> GoogleSheetsParticipants:
    return GoogleSheetsParticipants()
