# backend/app/api/routes/v2_challenges.py
"""
V2 presence challenge endpoints.

POST /v2/challenges/{id}/respond   — mobile reports outcome
GET  /v2/challenges/pending        — mobile polls for a live challenge
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


class PendingChallengeResponse(BaseModel):
    pending: bool
    challenge_id: Optional[int] = None
    session_id: Optional[str] = None
    issued_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    reason: Optional[str] = None


@router.post("/{challenge_id}/respond", response_model=ChallengeRespondResponse)
async def respond(
    challenge_id: int,
    request: ChallengeRespondRequest,
    db: DBSession = Depends(get_db),
):
    """Mobile reports the outcome of a re-verify."""
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


@router.get("/pending", response_model=PendingChallengeResponse)
async def get_pending_challenge(
    student_id: str = Query(..., description="V1 student string id, e.g. S001"),
    db: DBSession = Depends(get_db),
):
    """
    Return the student's current pending challenge, if any.

    Mobile polls this every heartbeat cycle (~60s). If a pending challenge
    exists (status='pending' and expires_at > now), it's returned with
    enough data to open the modal. If none, returns {pending: false}.

    Only one pending challenge per session is allowed (enforced by issue_challenge).
    """
    if not settings.V2_CHALLENGES_ENABLED:
        return PendingChallengeResponse(pending=False)

    student = db.query(Student).filter(Student.student_id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail=f"Student '{student_id}' not found")

    # Find the student's most recent pending challenge on an active session
    now_naive = datetime.now(timezone.utc).replace(tzinfo=None)

    row = (
        db.query(PresenceChallenge, Session)
        .join(Session, Session.id == PresenceChallenge.session_id)
        .filter(
            Session.student_id == student.id,
            Session.status == "active",
            PresenceChallenge.status == ChallengeStatus.pending,
            PresenceChallenge.expires_at > now_naive,
        )
        .order_by(PresenceChallenge.id.desc())
        .first()
    )

    if not row:
        return PendingChallengeResponse(pending=False)

    challenge, session = row
    return PendingChallengeResponse(
        pending=True,
        challenge_id=challenge.id,
        session_id=session.session_id,
        issued_at=challenge.issued_at,
        expires_at=challenge.expires_at,
        reason="wifi_fail_escalation",
    )