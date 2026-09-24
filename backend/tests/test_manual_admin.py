import io
from types import SimpleNamespace

from PIL import Image
from pypdf import PdfReader
from reportlab.pdfbase.pdfmetrics import stringWidth

from app.models import Role


def template_png():
    output = io.BytesIO()
    Image.new("RGB", (1000, 700), "white").save(output, format="PNG")
    return output.getvalue()


def test_manual_certificate_upload_position_and_pdf(client, make_user, login):
    admin = make_user(Role.ADMIN, "manual-cert@example.com")
    login(admin.email)
    upload = client.post("/api/certificates/templates", data={"name": "Manual"}, files={"file": ("art.png", template_png(), "image/png")})
    assert upload.status_code == 201
    template_id = upload.json()["id"]
    source = client.get(f"/api/certificates/templates/{template_id}/file")
    assert source.status_code == 200 and source.content.startswith(b"\x89PNG")
    assert client.patch(f"/api/certificates/templates/{template_id}", json={"name_x": 25, "name_y": 40, "college_x": 75, "college_y": 65}).status_code == 200
    assert client.post(f"/api/certificates/templates/{template_id}/activate").status_code == 200
    pdf = client.post("/api/certificates/manual", json={"participant_name": "John Doe", "college_name": "Example Engineering College"})
    assert pdf.status_code == 200
    page = PdfReader(io.BytesIO(pdf.content)).pages[0]
    assert (float(page.mediabox.width), float(page.mediabox.height)) == (1000, 700)
    positions = {}
    page.extract_text(visitor_text=lambda text, cm, tm, font, size: positions.update({text.strip(): (tm[4], tm[5])}) if text.strip() else None)
    assert abs(positions["John Doe"][0] + stringWidth("John Doe", "Helvetica-Bold", 36) / 2 - 250) < 0.01
    assert positions["John Doe"][1] == 420
    assert abs(positions["Example Engineering College"][0] + stringWidth("Example Engineering College", "Helvetica", 22) / 2 - 750) < 0.01
    assert positions["Example Engineering College"][1] == 245


def test_manual_send_plain_then_certificate_with_mock_brevo(client, make_user, login, monkeypatch):
    from app.api import emails
    admin = make_user(Role.ADMIN, "manual-email@example.com")
    login(admin.email)
    sent = []
    class Provider:
        def send(self, **kwargs):
            sent.append(kwargs)
            return f"brevo-{len(sent)}"
    monkeypatch.setattr(emails, "get_settings", lambda: SimpleNamespace(email_mode="production", brevo_api_key="test-key", email_from="sender@example.com", email_from_name="Tech Roulette"))
    monkeypatch.setattr(emails, "provider", lambda: Provider())
    payload = {"to": "recipient@example.com", "participant_name": "John Doe", "college_name": "Example College",
               "subject": "Hi {{participant_name}}", "body": "From {{college_name}}", "attach_certificate": False}
    plain = client.post("/api/email/manual/send", json=payload)
    assert plain.status_code == 200 and plain.json()["message_id"] == "brevo-1"
    assert sent[0]["attachment"] is None and sent[0]["subject"] == "Hi John Doe"
    upload = client.post("/api/certificates/templates", data={"name": "Manual"}, files={"file": ("art.png", template_png(), "image/png")})
    assert client.post(f"/api/certificates/templates/{upload.json()['id']}/activate").status_code == 200
    attached = client.post("/api/email/manual/send", json={**payload, "attach_certificate": True})
    assert attached.status_code == 200 and attached.json()["message_id"] == "brevo-2"
    assert "John Doe" in PdfReader(io.BytesIO(sent[1]["attachment"])).pages[0].extract_text()
    assert sent[1]["to"] == "recipient@example.com"
