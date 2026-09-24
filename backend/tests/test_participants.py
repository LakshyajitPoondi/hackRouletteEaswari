from types import SimpleNamespace

from fastapi import HTTPException
from app.models import Role
from app.services.google_sheets import GoogleSheetsParticipants
from app.services.google_sheets import _a1_range


def test_google_sheet_header_mapping(monkeypatch):
    source = GoogleSheetsParticipants()
    values = [["Timestamp", "Full Name", "Email Address", "College Name", "Certificate Eligible"],
              ["2026-09-23T10:00:00+05:30", "Alex Johnson", "ALEX@example.com", "Example College", "TRUE"]]
    monkeypatch.setattr(source, "_request", lambda method, range_name, **kwargs: {"values": values})
    person = source.list()[0]
    assert person.id == 2
    assert person.email == "alex@example.com"
    assert person.college == "Example College"
    assert person.certificate_eligible is True


def test_google_sheet_reports_missing_credentials(monkeypatch):
    from app.services import google_sheets

    monkeypatch.setattr(google_sheets, "get_settings", lambda: SimpleNamespace(
        google_sheets_spreadsheet_id="validSheetId", google_sheets_range="Responses!A:Z",
        google_service_account_json=None, google_sheets_api_key=None,
    ))
    source = GoogleSheetsParticipants()
    try:
        source.list()
    except HTTPException as exc:
        assert exc.status_code == 503
        assert "credentials are missing" in exc.detail
    else:
        assert False, "Expected a configuration error"


def test_form_response_tab_is_quoted_in_a1_ranges():
    assert _a1_range("Form Responses 1!A:Z") == "'Form Responses 1'!A:Z"
    assert _a1_range("Form Responses 1!J2") == "'Form Responses 1'!J2"
    assert _a1_range("'Form Responses 1'!A:Z") == "'Form Responses 1'!A:Z"


def test_participants_are_read_from_sheet_and_filtered(client, make_user, login, fake_sheet):
    fake_sheet.people = [fake_sheet.make(2, "Alex Johnson", "alex@example.com"), fake_sheet.make(3, "Beth", "beth@example.com", "Other College")]
    make_user(Role.SUPER_ADMIN, "super@example.com"); login("super@example.com")
    page = client.get("/api/participants", params={"search": "alex"})
    assert page.status_code == 200
    assert page.json()["total"] == 1
    assert page.json()["items"][0]["id"] == 2
    assert client.get("/api/participants/3").json()["college"] == "Other College"
    assert client.get("/api/participants/options").json()["colleges"] == ["Example College", "Other College"]
    assert client.get("/api/participants/export").status_code == 200
    metrics = client.get("/api/admin/dashboard").json()["metrics"]
    assert metrics["registrations"] == 2


def test_sheet_updates_keep_rbac(client, make_user, login, fake_sheet):
    fake_sheet.people = [fake_sheet.make(2, "Alex Johnson", "alex@example.com")]
    make_user(Role.STAFF, "staff@example.com"); make_user(Role.ADMIN, "admin@example.com")
    login("staff@example.com")
    assert client.patch("/api/participants/2", json={"certificate_eligible": False}).status_code == 403
    assert client.patch("/api/participants/2", json={"attendance_status": "PRESENT"}).json()["attendance_status"] == "PRESENT"
    login("admin@example.com")
    assert client.post("/api/participants/bulk-update", json={"participant_ids": [2], "action": "MARK_INELIGIBLE"}).json()["updated_count"] == 1
    assert fake_sheet.people[0].certificate_eligible is False


def test_same_origin_admin_post_is_allowed(client, make_user):
    make_user(Role.ADMIN, "same-origin@example.com")
    response = client.post("/api/auth/login", headers={"Origin": "http://testserver"},
                           json={"email": "same-origin@example.com", "password": "strong-test-password-123"})
    assert response.status_code == 200
    blocked = client.post("/api/auth/logout", headers={"Origin": "https://other.example"})
    assert blocked.status_code == 403
