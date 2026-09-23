"""Provider boundary and safe template rendering for campaign messages."""
import base64
import logging
import re
from typing import Protocol

import httpx

from app.core.config import get_settings

logger = logging.getLogger(__name__)
PLACEHOLDER = re.compile(r"{{\s*(participant_name|college_name)\s*}}")
UNKNOWN = re.compile(r"{{.*?}}", re.DOTALL)


def render(value: str, data: dict[str, str]) -> str:
    result = PLACEHOLDER.sub(lambda match: data[match.group(1)], value)
    if UNKNOWN.search(result):
        raise ValueError("Unknown email placeholder")
    return result


def filename(name: str) -> str:
    safe = re.sub(r"[^A-Za-z0-9]+", "_", name).strip("_")[:80] or "Participant"
    return f"Tech_Roulette_Certificate_{safe}.pdf"


class EmailProvider(Protocol):
    def send(self, *, to: str, sender_name: str, reply_to: str | None, subject: str, body: str,
             attachment: bytes | None, attachment_name: str | None, idempotency_key: str | None = None) -> str: ...


class DevelopmentProvider:
    def send(self, *, to: str, sender_name: str, reply_to: str | None, subject: str, body: str,
             attachment: bytes | None, attachment_name: str | None, idempotency_key: str | None = None) -> str:
        logger.info("Development email simulated: recipient=%s subject=%s attachment=%s", to, subject, attachment_name)
        return "development-simulated"


class ResendProvider:
    def send(self, *, to: str, sender_name: str, reply_to: str | None, subject: str, body: str,
             attachment: bytes | None, attachment_name: str | None, idempotency_key: str | None = None) -> str:
        settings = get_settings()
        if not settings.resend_api_key or not settings.email_from_address:
            raise RuntimeError("RESEND_API_KEY and EMAIL_FROM_ADDRESS are required in production")
        payload: dict = {
            "from": f"{sender_name} <{settings.email_from_address}>", "to": [to],
            "subject": subject, "text": body,
        }
        if reply_to or settings.email_reply_to:
            payload["reply_to"] = reply_to or settings.email_reply_to
        if attachment is not None:
            payload["attachments"] = [{"filename": attachment_name, "content": base64.b64encode(attachment).decode("ascii")}]
        headers = {"Authorization": f"Bearer {settings.resend_api_key}"}
        if idempotency_key:
            headers["Idempotency-Key"] = idempotency_key
        response = httpx.post("https://api.resend.com/emails", headers=headers, json=payload, timeout=15)
        if response.is_error:
            raise RuntimeError(f"Resend error {response.status_code}: {response.text[:300]}")
        return response.json()["id"]


def provider() -> EmailProvider:
    mode = get_settings().email_mode.lower()
    if mode == "development":
        return DevelopmentProvider()
    if mode == "production":
        return ResendProvider()
    raise RuntimeError("EMAIL_MODE must be development or production")
