"""Provider boundary and safe template rendering for campaign messages."""
import base64
import logging
import re
from html import escape
from typing import Protocol

import httpx

from app.core.config import get_settings

logger = logging.getLogger(__name__)
PLACEHOLDER = re.compile(r"{{\s*(participant_name|college_name)\s*}}|\[(name|college)\]")
UNKNOWN = re.compile(r"{{.*?}}|\[[a-z_]+\]", re.DOTALL | re.IGNORECASE)


def render(value: str, data: dict[str, str]) -> str:
    result = PLACEHOLDER.sub(lambda match: data[match.group(1) or {"name": "participant_name", "college": "college_name"}[match.group(2)]], value)
    unknown = UNKNOWN.search(result)
    if unknown:
        raise ValueError(f"Unsupported placeholder: {unknown.group(0)}")
    return result


def filename(name: str) -> str:
    safe = re.sub(r"[^A-Za-z0-9]+", "_", name).strip("_")[:80] or "Participant"
    return f"Tech_Roulette_Certificate_{safe}.pdf"


class EmailProvider(Protocol):
    def send(self, *, to: str, recipient_name: str | None = None, sender_name: str, reply_to: str | None, subject: str, body: str,
             attachment: bytes | None, attachment_name: str | None, idempotency_key: str | None = None) -> str: ...


class DevelopmentProvider:
    def send(self, *, to: str, recipient_name: str | None = None, sender_name: str, reply_to: str | None, subject: str, body: str,
             attachment: bytes | None, attachment_name: str | None, idempotency_key: str | None = None) -> str:
        logger.info("Development email simulated: recipient=%s subject=%s attachment=%s", to, subject, attachment_name)
        return "development-simulated"


class BrevoProvider:
    def send(self, *, to: str, recipient_name: str | None = None, sender_name: str, reply_to: str | None, subject: str, body: str,
             attachment: bytes | None, attachment_name: str | None, idempotency_key: str | None = None) -> str:
        settings = get_settings()
        if not settings.brevo_api_key or not settings.email_from:
            raise RuntimeError("BREVO_API_KEY and EMAIL_FROM are required in production")
        payload: dict = {
            "sender": {"name": sender_name or settings.email_from_name, "email": settings.email_from},
            "to": [{"email": to, **({"name": recipient_name} if recipient_name else {})}],
            "subject": subject, "textContent": body,
            "htmlContent": "<html><body>" + escape(body).replace("\n", "<br>") + "</body></html>",
        }
        if reply_to or settings.email_reply_to:
            payload["replyTo"] = {"email": reply_to or settings.email_reply_to}
        if attachment is not None:
            payload["attachment"] = [{"name": attachment_name or "certificate.pdf", "content": base64.b64encode(attachment).decode("ascii")}]
        headers = {"api-key": settings.brevo_api_key, "Accept": "application/json"}
        if idempotency_key:
            payload["headers"] = {"idempotencyKey": idempotency_key}
        response = httpx.post("https://api.brevo.com/v3/smtp/email", headers=headers, json=payload, timeout=15)
        if response.is_error:
            reasons = {400: "invalid sender, recipient, or attachment", 401: "API authentication failure", 403: "sender or account is not authorized", 429: "rate limit"}
            raise RuntimeError(f"Brevo {reasons.get(response.status_code, 'API error')} ({response.status_code}): {response.text[:300]}")
        message_id = response.json().get("messageId")
        if not message_id:
            raise RuntimeError("Brevo accepted the request without a messageId")
        return message_id


def provider() -> EmailProvider:
    mode = get_settings().email_mode.lower()
    if mode == "development":
        return DevelopmentProvider()
    if mode == "production":
        return BrevoProvider()
    raise RuntimeError("EMAIL_MODE must be development or production")
