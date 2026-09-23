"""Bounded, synchronous campaign work for API requests and Vercel Cron."""
import logging
from datetime import timezone

from sqlalchemy import or_, select
from sqlalchemy.orm import Session, selectinload

from app.models.certificate import CertificateTemplate
from app.models.email import EmailCampaign, EmailDelivery
from app.services.certificates import render_pdf
from app.services.email_campaigns import refresh_status, utcnow
from app.services.email_delivery import filename, provider, render

logger = logging.getLogger(__name__)
BATCH_SIZE = 25
MAX_ATTEMPTS = 3


def process_campaign(db: Session, campaign_id: int, limit: int = BATCH_SIZE) -> int:
    """Lock one delivery through its provider call, so overlapping invocations skip it."""
    processed = 0
    for _ in range(limit):
        delivery = db.scalar(
            select(EmailDelivery)
            .join(EmailCampaign)
            .options(selectinload(EmailDelivery.campaign))
            .where(EmailDelivery.campaign_id == campaign_id,
                   EmailDelivery.status == "PENDING",
                   EmailCampaign.status == "PROCESSING")
            .order_by(EmailDelivery.id)
            .with_for_update(of=EmailDelivery, skip_locked=True)
            .limit(1)
        )
        if delivery is None:
            db.rollback()
            break
        try:
            campaign = delivery.campaign
            delivery.attempt_count += 1
            template = db.get(CertificateTemplate, campaign.certificate_template_id)
            if not template:
                raise FileNotFoundError("Certificate template is missing")
            pdf = render_pdf(template, delivery.participant_name, delivery.college or "")
            values = {"participant_name": delivery.participant_name, "college_name": delivery.college or ""}
            message_id = provider().send(
                to=delivery.email, sender_name=campaign.sender_name, reply_to=campaign.reply_to,
                subject=render(campaign.subject, values), body=render(campaign.body, values),
                attachment=pdf if campaign.attach_certificate else None,
                attachment_name=filename(delivery.participant_name) if campaign.attach_certificate else None,
                idempotency_key=f"hackroulette-c{campaign.id}-d{delivery.id}",
            )
            delivery.status = "SENT"
            delivery.provider_message_id = message_id
            delivery.sent_at = utcnow()
            delivery.failed_at = None
            delivery.failure_reason = None
        except Exception as exc:
            logger.warning("Email delivery %s failed: %s", delivery.id, exc)
            delivery.status = "FAILED"
            delivery.failed_at = utcnow()
            delivery.failure_reason = str(exc)[:1000]
        db.commit()
        processed += 1
    campaign = db.get(EmailCampaign, campaign_id)
    if campaign and campaign.status == "PROCESSING":
        refresh_status(db, campaign)
    return processed


def process_due(db: Session, limit: int = BATCH_SIZE) -> dict[str, int]:
    ids = list(db.scalars(
        select(EmailCampaign.id)
        .where(or_(EmailCampaign.status == "PROCESSING",
                   (EmailCampaign.status == "SCHEDULED") & (EmailCampaign.scheduled_for <= utcnow())))
        .order_by(EmailCampaign.scheduled_for, EmailCampaign.id)
    ))
    processed = 0
    for campaign_id in ids:
        if processed >= limit:
            break
        campaign = db.scalar(select(EmailCampaign).where(EmailCampaign.id == campaign_id).with_for_update())
        scheduled = campaign.scheduled_for if campaign else None
        if scheduled and scheduled.tzinfo is None:
            scheduled = scheduled.replace(tzinfo=timezone.utc)
        if campaign and campaign.status == "SCHEDULED" and scheduled <= utcnow():
            campaign.status = "PROCESSING"
            campaign.started_at = utcnow()
            db.commit()
        else:
            db.rollback()
        processed += process_campaign(db, campaign_id, limit - processed)
    return {"campaigns_checked": len(ids), "deliveries_processed": processed}
