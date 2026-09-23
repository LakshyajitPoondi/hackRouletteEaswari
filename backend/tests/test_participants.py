from app.models import Role
from app.services.google_sheets import GoogleSheetsParticipants


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
