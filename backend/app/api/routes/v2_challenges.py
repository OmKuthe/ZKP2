# backend/app/api/routes/v2_challenges.py
"""
V2 presence challenge endpoints.

GET  /v2/challenges/pending?student_id=...   (mobile polls this each cycle)
POST /v2/challenges/{id}/respond             (mobile reports face-check result)
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session as DBSession

from ...models import PresenceChallenge, ChallengeStatus, Session, Student
from ...core.database import get_db
from ...core.config import settings
from ...services.challenges import respond_to_challenge

router = APIRouter(prefix="/v2/challenges", tags=["v2-challenges"])


class ChallengeRespondRequest(BaseModel):
    passed: bool
    note: Optional[str] = None


class ChallengeRespondResponse(BaseModel):
    challenge_id: int
    status: str
    message: str


def _iso_utc(dt: datetime) -> str:
    """ISO-8601 string with an explicit UTC offset.

    Without the offset, JavaScript parses the value as device-local time
    and the countdown shifts by the device's UTC offset.
    """
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).isoformat()


@router.get("/pending")
async def get_pending_challenge(
    student_id: str = Query(...),
    db: DBSession = Depends(get_db),
):
    """
    Return the student's most recent unexpired, unanswered challenge, if any.
    """
    if not settings.V2_CHALLENGES_ENABLED:
        return {"pending": False, "challenge": None}

    student = db.query(Student).filter(Student.student_id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail=f"Student '{student_id}' not found")

    # Naive UTC, matching how timestamps are stored elsewhere.
    now_utc = datetime.now(timezone.utc).replace(tzinfo=None)

    challenge = (
        db.query(PresenceChallenge)
        .join(Session, PresenceChallenge.session_id == Session.id)
        .filter(Session.student_id == student.id)
        .filter(PresenceChallenge.status == ChallengeStatus.PENDING)
        .filter(PresenceChallenge.expires_at > now_utc)
        .order_by(PresenceChallenge.id.desc())
        .first()
    )

    if not challenge:
        return {"pending": False, "challenge": None}

    return {
        "pending": True,
        "challenge": {
            "id": challenge.id,
            "expires_at": _iso_utc(challenge.expires_at),
        },
    }


@router.post("/{challenge_id}/respond", response_model=ChallengeRespondResponse)
async def respond(
    challenge_id: int,
    request: ChallengeRespondRequest,
    db: DBSession = Depends(get_db),
):
    """
    Mobile reports the outcome of a re-verify. On failure, the session
    is flagged and a `reverify_timeout` anomaly is created.
    """
    if not settings.V2_CHALLENGES_ENABLED:
        raise HTTPException(status_code=503, detail="Challenges are disabled")

    challenge = db.query(PresenceChallenge).filter(PresenceChallenge.id == challenge_id).first()
    if not challenge:
        raise HTTPException(status_code=404, detail="Challenge not found")

    ok, message = respond_to_challenge(db, challenge, passed=request.passed, note=request.note)
    if not ok:
        raise HTTPException(status_code=400, detail=message)

    db.commit()
    db.refresh(challenge)

    return ChallengeRespondResponse(
        challenge_id=challenge.id,
        status=challenge.status.value,
        message=message,
    )