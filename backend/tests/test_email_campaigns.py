from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
import base64
import io
from PIL import Image

from app.models import CertificateTemplate, EmailCampaign, Role
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


def test_scheduled_cron(client, db, make_user, login, fake_sheet, monkeypatch):
    from app.core.config import get_settings
    monkeypatch.setattr(get_settings(), "cron_secret", "test-cron-secret")
    admin = make_user(Role.ADMIN, "scheduler@example.com"); login(admin.email)
    fake_sheet.people = [fake_sheet.make(2, "Alex", "alex@example.com")]
    db.add(CertificateTemplate(name="PDF", file_data=png(), file_type="png", is_active=True, created_by=admin.id)); db.commit()
    future = (datetime.now(timezone.utc) + timedelta(hours=2)).isoformat()
    payload = {"name": "Scheduled", "sender_name": "Tech Roulette", "subject": "Hi {{participant_name}}", "body": "{{college_name}}",
               "selection": "all", "send_mode": "schedule", "scheduled_local": future, "timezone": "UTC", "confirmed": True}
    response = client.post("/api/email/campaigns", json=payload); assert response.status_code == 201
    campaign = db.get(EmailCampaign, response.json()["id"]); campaign.scheduled_for = datetime.now(timezone.utc) - timedelta(minutes=1); db.commit()
    result = client.get("/api/internal/process-scheduled-campaigns", headers={"Authorization": "Bearer test-cron-secret"})
    assert result.json()["deliveries_processed"] == 1
