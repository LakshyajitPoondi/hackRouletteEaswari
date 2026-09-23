from datetime import datetime, timezone
from typing import Annotated, Literal
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from email_validator import EmailNotValidError, validate_email
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.auth.dependencies import require_role
from app.core.config import get_settings
from app.db.session import get_db
from app.models.email import EmailCampaign, EmailDelivery, EmailTemplate
from app.models.user import Role, User
from app.services.campaign_processor import BATCH_SIZE, MAX_ATTEMPTS, process_campaign
from app.services.certificates import active_template, render_pdf
from app.services.google_sheets import participant_source
from app.services.email_campaigns import campaign_data, classify, recipients, utcnow
from app.services.email_delivery import render, provider

router = APIRouter(prefix="/api/email", tags=["email"])
Admin = Annotated[User, Depends(require_role(Role.SUPER_ADMIN, Role.ADMIN))]
Database = Annotated[Session, Depends(get_db)]


class TemplateInput(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    subject: str = Field(min_length=1, max_length=300)
    body: str = Field(min_length=1)


class Selection(BaseModel):
    selection: Literal["all", "selected", "filtered"] = "all"
    participant_ids: list[int] | None = None
    college: str | None = None
    attendance: Literal["REGISTERED", "PRESENT", "ABSENT"] | None = None
    resend: bool = False


class CampaignInput(Selection):
    name: str = Field(min_length=1, max_length=160)
    email_template_id: int | None = None
    sender_name: str = Field(min_length=1, max_length=160)
    reply_to: str | None = None
    subject: str = Field(min_length=1, max_length=300)
    body: str = Field(min_length=1)
    attach_certificate: bool = True
    send_mode: Literal["now", "schedule"]
    scheduled_local: datetime | None = None
    timezone: str = "Asia/Kolkata"
    confirmed: bool = False


class TestInput(BaseModel):
    to: str
    sender_name: str
    reply_to: str | None = None
    subject: str
    body: str
    participant_id: int | None = None


def valid_email(address: str | None):
    if not address:
        return None
    try:
        return validate_email(address, check_deliverability=False).normalized
    except EmailNotValidError:
        raise HTTPException(422, "Invalid email address") from None


def preview(subject: str, body: str):
    sample = {"participant_name": "Alex Johnson", "college_name": "Example College"}
    try:
        return {"subject": render(subject, sample), "body": render(body, sample)}
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from None


@router.get("/mode")
def mode(_: Admin):
    return {"mode": get_settings().email_mode, "sending_enabled": get_settings().email_mode == "production"}


@router.get("/templates")
def templates(db: Database, _: Admin):
    return list(db.scalars(select(EmailTemplate).order_by(EmailTemplate.id.desc())))


@router.post("/templates", status_code=201)
def create_template(payload: TemplateInput, db: Database, actor: Admin):
    preview(payload.subject, payload.body)
    item = EmailTemplate(**payload.model_dump(), created_by=actor.id)
    db.add(item); db.commit(); db.refresh(item)
    return item


@router.patch("/templates/{template_id}")
def update_template(template_id: int, payload: TemplateInput, db: Database, _: Admin):
    item = db.get(EmailTemplate, template_id)
    if not item:
        raise HTTPException(404, "Template not found")
    preview(payload.subject, payload.body)
    for key, value in payload.model_dump().items():
        setattr(item, key, value)
    db.commit(); db.refresh(item)
    return item


@router.delete("/templates/{template_id}", status_code=204)
def delete_template(template_id: int, db: Database, _: Admin):
    item = db.get(EmailTemplate, template_id)
    if not item:
        raise HTTPException(404, "Template not found")
    db.delete(item); db.commit()


@router.post("/preview")
def preview_email(payload: TemplateInput, _: Admin):
    return preview(payload.subject, payload.body)


@router.post("/test")
def test_email(payload: TestInput, db: Database, _: Admin):
    to = valid_email(payload.to)
    reply = valid_email(payload.reply_to)
    rendered = preview(payload.subject, payload.body)
    attachment = attachment_name = None
    if payload.participant_id:
        from app.services.email_delivery import filename
        person = participant_source().get(payload.participant_id)
        attachment = render_pdf(active_template(db), person.full_name, person.college or "")
        attachment_name = filename(person.full_name)
        values = {"participant_name": person.full_name, "college_name": person.college or ""}
        rendered = {"subject": render(payload.subject, values), "body": render(payload.body, values)}
    try:
        message_id = provider().send(to=to, sender_name=payload.sender_name, reply_to=reply,
                                     subject=rendered["subject"], body=rendered["body"], attachment=attachment, attachment_name=attachment_name)
    except Exception as exc:
        raise HTTPException(502, str(exc)[:300]) from None
    return {"recipient": to, "message_id": message_id, "mode": get_settings().email_mode}


@router.post("/recipients/summary")
def recipient_summary(payload: Selection, db: Database, _: Admin):
    if payload.selection == "selected" and not payload.participant_ids:
        raise HTTPException(422, "Select at least one participant")
    result = classify(db, recipients(db, **payload.model_dump()))
    return {key: value for key, value in result.items() if key != "ready"}


@router.get("/campaigns")
def campaigns(db: Database, _: Admin):
    items = db.scalars(select(EmailCampaign).options(selectinload(EmailCampaign.deliveries), selectinload(EmailCampaign.creator)).order_by(EmailCampaign.id.desc())).all()
    return [campaign_data(item) for item in items]


@router.get("/campaigns/{campaign_id}")
def campaign_detail(campaign_id: int, db: Database, _: Admin):
    item = db.scalar(select(EmailCampaign).options(selectinload(EmailCampaign.deliveries), selectinload(EmailCampaign.creator)).where(EmailCampaign.id == campaign_id))
    if not item:
        raise HTTPException(404, "Campaign not found")
    return {**campaign_data(item), "deliveries": [{"id": d.id, "participant_id": d.participant_id, "participant_name": d.participant_name,
            "email": d.email, "status": d.status, "attempt_count": d.attempt_count, "provider_message_id": d.provider_message_id,
            "sent_at": d.sent_at, "failed_at": d.failed_at, "failure_reason": d.failure_reason} for d in item.deliveries]}


@router.post("/campaigns", status_code=201)
def create_campaign(payload: CampaignInput, db: Database, actor: Admin):
    if not payload.confirmed:
        raise HTTPException(422, "Confirm the recipient summary before sending")
    preview(payload.subject, payload.body)
    settings = get_settings()
    if settings.email_mode not in {"development", "production"}:
        raise HTTPException(503, "EMAIL_MODE must be development or production")
    if settings.email_mode == "production" and (not settings.resend_api_key or not settings.email_from_address):
        raise HTTPException(503, "Production email provider is not configured")
    reply = valid_email(payload.reply_to)
    if payload.email_template_id and not db.get(EmailTemplate, payload.email_template_id):
        raise HTTPException(404, "Email template not found")
    scheduled = None
    if payload.send_mode == "schedule":
        if not payload.scheduled_local:
            raise HTTPException(422, "Scheduled date and time are required")
        try:
            zone = ZoneInfo(payload.timezone)
        except ZoneInfoNotFoundError:
            raise HTTPException(422, "Invalid timezone") from None
        scheduled = payload.scheduled_local.replace(tzinfo=zone).astimezone(timezone.utc)
        if scheduled <= utcnow():
            raise HTTPException(422, "Scheduled time must be in the future")
    result = classify(db, recipients(db, **payload.model_dump(include={"selection", "participant_ids", "college", "attendance", "resend"})))
    if not result["ready"]:
        raise HTTPException(422, "No eligible recipients have a valid email address")
    item = EmailCampaign(name=payload.name.strip(), email_template_id=payload.email_template_id,
                         sender_name=payload.sender_name.strip(), reply_to=reply, subject=payload.subject,
                         body=payload.body, attach_certificate=payload.attach_certificate,
                         status="SCHEDULED" if scheduled else "PROCESSING", scheduled_for=scheduled, created_by=actor.id,
                         started_at=None if scheduled else utcnow())
    db.add(item); db.flush()
    for person in result["ready"]:
        if item.certificate_template_id is None:
            item.certificate_template_id = active_template(db).id
        db.add(EmailDelivery(campaign_id=item.id, participant_id=person.id, participant_key=person.participant_key,
                             participant_name=person.full_name, college=person.college, email=person.email, status="PENDING"))
    db.commit(); db.refresh(item)
    if not scheduled:
        process_campaign(db, item.id, BATCH_SIZE)
        db.refresh(item)
    return {"id": item.id, "status": item.status, "recipients": len(result["ready"]), "skipped_invalid": result["invalid_emails"]}


@router.post("/campaigns/{campaign_id}/cancel")
def cancel(campaign_id: int, db: Database, _: Admin):
    item = db.get(EmailCampaign, campaign_id)
    if not item or item.status != "SCHEDULED":
        raise HTTPException(409, "Only scheduled campaigns can be cancelled")
    item.status = "CANCELLED"; db.commit()
    return {"status": item.status}


class Reschedule(BaseModel):
    scheduled_local: datetime
    timezone: str = "Asia/Kolkata"


@router.post("/campaigns/{campaign_id}/reschedule")
def reschedule(campaign_id: int, payload: Reschedule, db: Database, _: Admin):
    item = db.get(EmailCampaign, campaign_id)
    if not item or item.status != "SCHEDULED":
        raise HTTPException(409, "Only scheduled campaigns can be rescheduled")
    try:
        zone = ZoneInfo(payload.timezone)
    except ZoneInfoNotFoundError:
        raise HTTPException(422, "Invalid timezone") from None
    when = payload.scheduled_local.replace(tzinfo=zone).astimezone(timezone.utc)
    if when <= utcnow():
        raise HTTPException(422, "Scheduled time must be in the future")
    item.scheduled_for = when; db.commit()
    return {"status": item.status, "scheduled_for": when}


@router.post("/campaigns/{campaign_id}/retry")
def retry(campaign_id: int, db: Database, _: Admin):
    item = db.scalar(select(EmailCampaign).options(selectinload(EmailCampaign.deliveries)).where(EmailCampaign.id == campaign_id))
    if not item or item.status not in {"FAILED", "PARTIALLY_FAILED"}:
        raise HTTPException(409, "Campaign has no completed failures")
    failed = [d for d in item.deliveries if d.status == "FAILED" and d.attempt_count < MAX_ATTEMPTS]
    if not failed:
        raise HTTPException(409, "No failed deliveries with attempts remaining")
    for delivery in failed:
        delivery.status = "PENDING"; delivery.failed_at = None
    item.status = "PROCESSING"; item.completed_at = None
    db.commit()
    process_campaign(db, item.id, BATCH_SIZE)
    return {"retried": len(failed)}
