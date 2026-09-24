from types import SimpleNamespace
import base64
import io
from PIL import Image

from app.models import CertificateTemplate, Role
from app.services.email_delivery import ResendProvider, render


def png():
    output = io.BytesIO(); Image.new("RGB", (1000, 700), "white").save(output, format="PNG"); return output.getvalue()


def test_render_and_resend(monkeypatch):
    from app.services import email_delivery
    assert render("Hello {{participant_name}} from {{college_name}}", {"participant_name": "Alex", "college_name": "EEC"}) == "Hello Alex from EEC"
    captured = {}
    class Response:
        is_error = False
        def json(self): return {"id": "provider-123"}
    monkeypatch.setattr(email_delivery, "get_settings", lambda: SimpleNamespace(resend_api_key="key", email_from_address="certs@example.com", email_reply_to=None))
    monkeypatch.setattr(email_delivery.httpx, "post", lambda url, **kwargs: (captured.update(kwargs) or Response()))
    assert ResendProvider().send(to="test@example.com", sender_name="Tech Roulette", reply_to=None, subject="Certificate", body="Attached", attachment=b"%PDF-test", attachment_name="certificate.pdf", idempotency_key="delivery-1") == "provider-123"
    assert base64.b64decode(captured["json"]["attachments"][0]["content"]) == b"%PDF-test"


def test_send_now_generates_pdf_and_prevents_duplicate(client, db, make_user, login, fake_sheet):
    admin = make_user(Role.ADMIN, "admin@example.com"); login(admin.email)
    fake_sheet.people = [fake_sheet.make(2, "Alex Johnson", "alex@example.com", "Example College")]
    template = CertificateTemplate(name="PDF", file_data=png(), file_type="png", is_active=True, created_by=admin.id)
    db.add(template); db.commit()
    payload = {"name": "Certificates", "sender_name": "Tech Roulette", "subject": "Hi {{participant_name}}",
               "body": "For {{college_name}}", "selection": "all", "send_mode": "now", "confirmed": True}
    response = client.post("/api/email/campaigns", json=payload)
    assert response.status_code == 201, response.text
    detail = client.get(f"/api/email/campaigns/{response.json()['id']}").json()
    assert detail["status"] == "COMPLETED" and detail["deliveries"][0]["status"] == "SENT"
    assert client.post("/api/email/recipients/summary", json={"selection": "all"}).json()["recipients_ready"] == 0
    assert client.post("/api/email/recipients/summary", json={"selection": "all", "resend": True}).json()["recipients_ready"] == 1


def test_manual_email_without_attachment_needs_no_certificate_template(client, make_user, login, fake_sheet, monkeypatch):
    from app.services import campaign_processor

    admin = make_user(Role.ADMIN, "plain@example.com"); login(admin.email)
    fake_sheet.people = [fake_sheet.make(2, "Alex Johnson", "alex@example.com", "Example College")]
    sent = []

    class Provider:
        def send(self, **kwargs):
            sent.append(kwargs)
            return "provider-123"

    monkeypatch.setattr(campaign_processor, "provider", lambda: Provider())
    response = client.post("/api/email/campaigns", json={
        "name": "Plain email", "sender_name": "Tech Roulette", "subject": "Hi {{participant_name}}",
        "body": "From {{college_name}}", "selection": "all", "confirmed": True,
        "attach_certificate": False,
    })
    assert response.status_code == 201, response.text
    assert response.json()["status"] == "COMPLETED"
    assert sent[0]["attachment"] is None
    assert sent[0]["subject"] == "Hi Alex Johnson"


def test_send_now_processes_all_recipients_and_retries_failures(client, db, make_user, login, fake_sheet, monkeypatch):
    from app.services import campaign_processor
    admin = make_user(Role.ADMIN, "admin-batch@example.com"); login(admin.email)
    fake_sheet.people = [fake_sheet.make(i, f"Participant {i}", f"p{i}@example.com") for i in range(2, 28)]
    db.add(CertificateTemplate(name="PDF", file_data=png(), file_type="png", is_active=True, created_by=admin.id)); db.commit()
    attempts = []
    class Provider:
        def send(self, **kwargs):
            assert kwargs["attachment"].startswith(b"%PDF")
            attempts.append(kwargs["to"])
            if kwargs["to"] == "p27@example.com" and attempts.count(kwargs["to"]) == 1:
                raise RuntimeError("Temporary failure")
            return "provider-123"
    monkeypatch.setattr(campaign_processor, "provider", lambda: Provider())
    payload = {"name": "Certificates", "sender_name": "Tech Roulette", "subject": "Hi {{participant_name}}",
               "body": "For {{college_name}}", "selection": "all", "send_mode": "now", "confirmed": True}
    response = client.post("/api/email/campaigns", json=payload)
    assert response.status_code == 201, response.text
    campaign_id = response.json()["id"]
    assert response.json()["status"] == "PROCESSING"
    while client.get(f"/api/email/campaigns/{campaign_id}").json()["status"] == "PROCESSING":
        continued = client.post(f"/api/email/campaigns/{campaign_id}/continue")
        assert continued.status_code == 200, continued.text
        assert continued.json()["processed"] > 0
    detail = client.get(f"/api/email/campaigns/{campaign_id}").json()
    assert detail["status"] == "PARTIALLY_FAILED"
    assert detail["sent_count"] == 25 and detail["failed_count"] == 1
    retry = client.post(f"/api/email/campaigns/{campaign_id}/retry")
    assert retry.status_code == 200, retry.text
    assert retry.json()["retried"] == 1
    detail = client.get(f"/api/email/campaigns/{campaign_id}").json()
    assert detail["status"] == "COMPLETED" and detail["sent_count"] == 26
    assert attempts.count("p2@example.com") == 1
    assert attempts.count("p27@example.com") == 2
    assert client.post(f"/api/email/campaigns/{campaign_id}/continue").status_code == 409
    assert client.post("/api/email/campaigns", json={**payload, "send_mode": "schedule"}).status_code == 422
