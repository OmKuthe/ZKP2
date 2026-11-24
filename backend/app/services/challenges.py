# backend/app/services/challenges.py
"""
Presence challenge lifecycle.

Phase 4 model:
    - A challenge is issued when WiFi fails twice for a session.
    - It expires after REVERIFY_TIMEOUT_MIN.
    - Mobile responds with passed=true|false.
    - On fail (explicit or expiry): anomaly + session flagged.

One challenge per session at a time — if a pending challenge already
exists, `issue_challenge` is a no-op (returns the existing row).
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, Tuple

from sqlalchemy.orm import Session as DBSession

from ..models import (
    Session, Student, Device, PresenceChallenge, VerificationEvent, Anomaly,
    VerificationLayer, VerificationEventType, ChallengeStatus,
)
from ..core.config import settings
from .push import send_expo_push

logger = logging.getLogger(__name__)


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _utc_naive(dt: datetime) -> datetime:
    return dt.replace(tzinfo=None)


def issue_challenge(
    db: DBSession,
    session: Session,
    reason: str = "wifi_fail_escalation",
) -> Optional[PresenceChallenge]:
    """
    Create a challenge for `session` and push to the student's devices.
    If a pending challenge already exists for this session, returns it
    unchanged (no duplicate challenges).

    Caller must commit.
    """
    if not settings.V2_CHALLENGES_ENABLED:
        logger.info("⏸  Challenge issuance skipped (V2_CHALLENGES_ENABLED=false)")
        return None

    # Idempotent: one pending challenge per session
    existing = (
        db.query(PresenceChallenge)
        .filter(
            PresenceChallenge.session_id == session.id,
            PresenceChallenge.status == ChallengeStatus.pending,
        )
        .first()
    )
    if existing is not None:
        logger.info(f"ℹ️  Pending challenge already exists: id={existing.id}")
        return existing

    now = _utc_now()
    expires = now + timedelta(minutes=settings.REVERIFY_TIMEOUT_MIN)

    challenge = PresenceChallenge(
        session_id=session.id,
        device_id=None,  # populated below if we find a device
        issued_at=_utc_naive(now),
        expires_at=_utc_naive(expires),
        status=ChallengeStatus.pending,
    )
    db.add(challenge)
    db.flush()  # get challenge.id

    # Record the event
    db.add(VerificationEvent(
        session_id=session.id,
        layer=VerificationLayer.chain,
        event_type=VerificationEventType.challenge_sent,
        occurred_at=now,
        source_table="presence_challenges",
        source_id=challenge.id,
    ))

    # Find the student's most recent device and push
    student = db.query(Student).filter(Student.id == session.student_id).first()
    if student:
        device = (
            db.query(Device)
            .filter(Device.student_id == student.id, Device.deleted_at.is_(None))
            .order_by(Device.last_seen_at.desc())
            .first()
        )
        if device is not None:
            challenge.device_id = device.id
            if device.push_token:
                ok = send_expo_push(
                    token=device.push_token,
                    title="Verify your presence",
                    body=f"Please verify within {settings.REVERIFY_TIMEOUT_MIN} minutes to keep your session active.",
                    data={
                        "type": "presence_challenge",
                        "challenge_id": challenge.id,
                        "session_id": session.session_id,
                        "expires_at": expires.isoformat(),
                        "reason": reason,
                    },
                )
                logger.info(f"📣 Push sent={ok} for challenge {challenge.id}")

    logger.info(
        f"📝 Challenge issued: id={challenge.id} session={session.session_id} "
        f"expires={expires.isoformat()} reason={reason}"
    )
    return challenge


def respond_to_challenge(
    db: DBSession,
    challenge: PresenceChallenge,
    passed: bool,
    note: Optional[str] = None,
) -> Tuple[bool, str]:
    """
    Mark a pending challenge as passed or failed.

    On failure: creates an anomaly, flags the session.
    Caller must commit.

    Returns (ok, message).
    """
    if challenge.status != ChallengeStatus.pending:
        return False, f"Challenge already {challenge.status.value}"

    now = _utc_now()

    if now.timestamp() > challenge.expires_at.replace(tzinfo=timezone.utc).timestamp():
        # Too late — flip to expired (sweeper will do the same, but be consistent)
        challenge.status = ChallengeStatus.expired
        challenge.responded_at = _utc_naive(now)
        _handle_challenge_failure(db, challenge, reason="responded_after_expiry", note=note)
        return True, "Challenge expired before response"

    challenge.responded_at = _utc_naive(now)
    challenge.status = ChallengeStatus.passed if passed else ChallengeStatus.failed

    db.add(VerificationEvent(
        session_id=challenge.session_id,
        layer=VerificationLayer.chain,
        event_type=(
            VerificationEventType.challenge_passed if passed
            else VerificationEventType.challenge_failed
        ),
        occurred_at=now,
        source_table="presence_challenges",
        source_id=challenge.id,
    ))

    if passed:
        logger.info(f"✅ Challenge {challenge.id} passed")
        return True, "Challenge passed"

    _handle_challenge_failure(db, challenge, reason="explicit_fail", note=note)
    return True, "Challenge failed — session flagged"


def _handle_challenge_failure(
    db: DBSession,
    challenge: PresenceChallenge,
    reason: str,
    note: Optional[str] = None,
) -> None:
    """Shared side-effects when a challenge fails or expires."""
    session = db.query(Session).filter(Session.id == challenge.session_id).first()
    if not session:
        logger.warning(f"⚠️ Challenge {challenge.id}: session {challenge.session_id} not found")
        return

    # Flag the session
    if session.status == "active":
        session.status = "flagged"

    # Anomaly — dedupe by (session, type, unresolved)
    existing = (
        db.query(Anomaly)
        .filter(
            Anomaly.session_id == session.id,
            Anomaly.type == "reverify_timeout",
            Anomaly.status == "open",
        )
        .first()
    )
    desc = f"Presence challenge {reason} (challenge_id={challenge.id})"
    if note:
        desc += f" — {note}"

    if existing is None:
        db.add(Anomaly(
            session_id=session.id,
            student_id=session.student_id,
            company_id=session.company_id,
            type="reverify_timeout",
            severity="HIGH",
            description=desc,
            resolved=False,
            status="open",
        ))
    else:
        existing.description = (existing.description or "") + "\n" + desc

    logger.warning(f"🚨 Challenge {challenge.id} failed ({reason}); session {session.session_id} flagged")


def sweep_expired_challenges(db: DBSession) -> int:
    """
    Find all pending challenges whose expires_at has passed; mark them
    expired, create anomalies, flag sessions. Returns count swept.

    Called periodically by the sweeper task in main.py.
    Caller must commit.
    """
    now = _utc_naive(_utc_now())
    pending = (
        db.query(PresenceChallenge)
        .filter(
            PresenceChallenge.status == ChallengeStatus.pending,
            PresenceChallenge.expires_at < now,
        )
        .all()
    )
    for ch in pending:
        ch.status = ChallengeStatus.expired
        ch.responded_at = now

        db.add(VerificationEvent(
            session_id=ch.session_id,
            layer=VerificationLayer.chain,
            event_type=VerificationEventType.challenge_failed,
            occurred_at=_utc_now(),
            source_table="presence_challenges",
            source_id=ch.id,
        ))

        _handle_challenge_failure(db, ch, reason="timeout")

    if pending:
        logger.info(f"⏱  Sweeper expired {len(pending)} challenge(s)")
    return len(pending)