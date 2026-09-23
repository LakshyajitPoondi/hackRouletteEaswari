from datetime import datetime, timezone
from email_validator import EmailNotValidError, validate_email
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.email import EmailCampaign, EmailDelivery
from app.services.google_sheets import SheetParticipant, participant_source


def utcnow():
    return datetime.now(timezone.utc)


def recipients(db: Session, *, selection: str, participant_ids: list[int] | None,
               college: str | None, attendance: str | None,
               resend: bool = False, **_):
    people = [p for p in participant_source().list() if p.certificate_eligible and not p.is_disqualified]
    if selection == "selected":
        ids = set(participant_ids or []); people = [p for p in people if p.id in ids]
    elif selection == "filtered":
        if college: people = [p for p in people if p.college == college]
        if attendance: people = [p for p in people if p.attendance_status == attendance]
    if not resend:
        sent = set(db.scalars(select(EmailDelivery.participant_key).where(EmailDelivery.status == "SENT")))
        people = [p for p in people if p.participant_key not in sent]
    return people


def classify(db: Session, people: list[SheetParticipant]):
    ready, invalid = [], []
    for person in people:
        try: validate_email(person.email, check_deliverability=False)
        except (EmailNotValidError, TypeError): invalid.append(person.id); continue
        ready.append(person)
    return {"total_selected": len(people), "invalid_emails": len(invalid),
            "recipients_ready": len(ready), "ready": ready, "invalid_ids": invalid}


def campaign_data(campaign: EmailCampaign):
    deliveries = campaign.deliveries
    return {"id": campaign.id, "name": campaign.name, "email_template_id": campaign.email_template_id,
            "certificate_template_id": campaign.certificate_template_id, "sender_name": campaign.sender_name,
            "reply_to": campaign.reply_to, "subject": campaign.subject, "body": campaign.body,
            "attach_certificate": campaign.attach_certificate, "status": campaign.status,
            "created_by": campaign.created_by,
            "created_by_name": campaign.creator.name, "created_at": campaign.created_at,
            "started_at": campaign.started_at, "completed_at": campaign.completed_at,
            "recipient_count": len(deliveries), "sent_count": sum(d.status == "SENT" for d in deliveries),
            "failed_count": sum(d.status == "FAILED" for d in deliveries)}


def refresh_status(db: Session, campaign: EmailCampaign):
    locked = db.scalar(select(EmailCampaign).where(EmailCampaign.id == campaign.id).with_for_update())
    statuses = list(db.scalars(select(EmailDelivery.status).where(EmailDelivery.campaign_id == campaign.id)))
    if not statuses or any(s == "PENDING" for s in statuses): return
    sent = statuses.count("SENT")
    locked.status = "COMPLETED" if sent == len(statuses) else "PARTIALLY_FAILED" if sent else "FAILED"
    locked.completed_at = utcnow(); db.commit()
