import io
from PIL import Image
from pypdf import PdfReader
from app.models import Role


def png():
    output = io.BytesIO(); Image.new("RGB", (1000, 700), "white").save(output, format="PNG"); return output.getvalue()


def test_template_two_fields_and_on_demand_pdf(client, make_user, login, fake_sheet):
    fake_sheet.people = [fake_sheet.make(2, "Alex Johnson", "alex@example.com", "Example College")]
    admin = make_user(Role.ADMIN, "admin@example.com"); login(admin.email)
    uploaded = client.post("/api/certificates/templates", data={"name": "Participation"}, files={"file": ("art.png", png(), "image/png")})
    assert uploaded.status_code == 201
    template_id = uploaded.json()["id"]
    updated = client.patch(f"/api/certificates/templates/{template_id}", json={"name_x": 48, "college_x": 52, "college_y": 64, "college_font_size": 20})
    assert updated.status_code == 200 and updated.json()["college_x"] == 52
    assert client.post(f"/api/certificates/templates/{template_id}/activate").status_code == 200
    preview = client.get(f"/api/certificates/templates/{template_id}/preview")
    assert preview.status_code == 200 and len(PdfReader(io.BytesIO(preview.content)).pages) == 1
    pdf = client.get("/api/certificates/participants/2/download")
    assert pdf.status_code == 200 and len(PdfReader(io.BytesIO(pdf.content)).pages) == 1
    row = client.get("/api/certificates/participants/2").json()
    assert row["status"] == "READY" and "certificate_id" not in row
