import secrets

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.session import get_db
from app.services.campaign_processor import process_due

router = APIRouter(prefix="/api/internal", tags=["internal"])


@router.get("/process-scheduled-campaigns")
@router.post("/process-scheduled-campaigns")
def scheduled_campaigns(authorization: str | None = Header(default=None), db: Session = Depends(get_db)):
    secret = get_settings().cron_secret
    if not secret or not authorization or not secrets.compare_digest(authorization, f"Bearer {secret}"):
        raise HTTPException(401, "Unauthorized")
    return process_due(db)
