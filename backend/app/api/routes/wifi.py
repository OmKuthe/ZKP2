# # backend/app/api/routes/wifi.py
# """
# Wi-Fi Fingerprinting API endpoints.

# Provides two main operations:
#     1. /enroll  — Capture the Wi-Fi environment at check-in
#     2. /verify  — Check if the current environment matches the enrolled template

# Uses the JSR (Jaccard Similarity with RSSI) algorithm from the research paper.

# V2: emits verification_events for each verify call.
# """
# from fastapi import APIRouter, HTTPException, Depends
# from sqlalchemy.orm import Session as DBSession
# from datetime import datetime, timezone
# import logging

# from ...models import (
#     Session,
#     Student,
#     Company,
#     Anomaly,
#     WiFiTemplate,
#     WiFiVerification,
#     # V2
#     VerificationEvent,
#     VerificationLayer,
#     VerificationEventType,
# )
# from ...core.database import get_db
# from ...core.config import settings
# from ...schemas.wifi import (
#     WiFiEnrollRequest,
#     WiFiEnrollResponse,
#     WiFiVerifyRequest,
#     WiFiVerifyResponse,
#     WiFiTemplateInfo,
#     WiFiVerificationInfo,
# )
# from ...services.wifi_fingerprint import (
#     create_template,
#     verify_fingerprint,
#     template_to_json,
#     template_from_json,
#     fingerprint_to_json,
#     fingerprint_from_json,
#     DEFAULT_THRESHOLD,
#     DEFAULT_RSSI_TOLERANCE,
# )

# router = APIRouter(prefix="/wifi", tags=["wifi"])
# logger = logging.getLogger(__name__)


# def _utc_naive() -> datetime:
#     return datetime.now(timezone.utc).replace(tzinfo=None)


# # ============================================================
# # ENROLL: Capture the Wi-Fi environment for a session
# # ============================================================

# @router.post("/enroll", response_model=WiFiEnrollResponse)
# async def enroll_wifi_environment(
#     request: WiFiEnrollRequest,
#     db: DBSession = Depends(get_db),
# ):
#     """
#     Enroll the Wi-Fi environment for a session.

#     Called by the mobile app immediately after successful check-in.
#     Takes multiple scans (captured over a short window) and aggregates
#     them into a single template.

#     Only one template per session is allowed. If a template already exists,
#     the existing one is superseded (marked inactive) and a new one is created.
#     """
#     logger.info(f"📶 Enroll request for session: {request.session_id}")

#     # 1. Find the active session
#     session = (
#         db.query(Session)
#         .filter(Session.session_id == request.session_id, Session.status == "active")
#         .first()
#     )
#     if not session:
#         raise HTTPException(
#             status_code=404,
#             detail=f"No active session found for session_id={request.session_id}",
#         )

#     # 2. Convert Pydantic models to plain dicts for the service
#     scans_as_dicts = [
#         [ap.model_dump() for ap in scan] for scan in request.scans
#     ]

#     # 3. Build the template using the JSR service
#     template_result = create_template(
#         scans=scans_as_dicts,
#         rssi_tolerance=DEFAULT_RSSI_TOLERANCE,
#     )

#     logger.info(
#         f"📶 Template built: {template_result['ap_count']} APs, "
#         f"valid={template_result['is_valid']}"
#     )

#     # 4. Supersede any existing template for this session (idempotency)
#     existing = (
#         db.query(WiFiTemplate)
#         .filter(WiFiTemplate.session_id == session.id)
#         .first()
#     )
#     if existing:
#         existing.status = "superseded"
#         logger.info(f"📶 Superseded previous template id={existing.id}")

#     # 5. Create the new template record
#     new_template = WiFiTemplate(
#         session_id=session.id,
#         company_id=session.company_id,
#         student_id=session.student_id,
#         template_data=template_to_json(template_result),
#         ap_count=template_result["ap_count"],
#         threshold=template_result["threshold"],
#         rssi_tolerance=template_result["rssi_tolerance"],
#         status="active",
#         is_valid=template_result["is_valid"],
#         captured_at=_utc_naive(),
#     )
#     db.add(new_template)

#     # 6. Update the session
#     session.has_wifi_template = True
#     session.last_wifi_check = _utc_naive()
#     session.last_wifi_score = None  # Not yet verified

#     db.commit()
#     db.refresh(new_template)

#     logger.info(f"✅ Template created: id={new_template.id}")

#     return WiFiEnrollResponse(
#         success=True,
#         message=template_result["message"],
#         template_id=new_template.id,
#         ap_count=new_template.ap_count,
#         threshold=new_template.threshold,
#         is_valid=new_template.is_valid,
#     )


# # ============================================================
# # VERIFY: Check a fingerprint against the enrolled template
# # ============================================================

# @router.post("/verify", response_model=WiFiVerifyResponse)
# async def verify_wifi_environment(
#     request: WiFiVerifyRequest,
#     db: DBSession = Depends(get_db),
# ):
#     """
#     Verify the current Wi-Fi environment against the enrolled template.

#     Called periodically by the mobile app (e.g., alongside continuity checks).

#     Returns:
#         - verified: True if JSR score >= threshold
#         - is_anomaly: True if verified == False
#         - similarity_score: The JSR score
#         - Various diagnostics

#     V2: emits a verification_events row alongside the WiFiVerification row.
#     """
#     logger.info(f"📶 Verify request for session: {request.session_id}")

#     # 1. Find the active session
#     session = (
#         db.query(Session)
#         .filter(Session.session_id == request.session_id, Session.status == "active")
#         .first()
#     )
#     if not session:
#         raise HTTPException(
#             status_code=404,
#             detail=f"No active session found for session_id={request.session_id}",
#         )

#     # 2. Find the active template for this session
#     template_record = (
#         db.query(WiFiTemplate)
#         .filter(
#             WiFiTemplate.session_id == session.id,
#             WiFiTemplate.status == "active",
#         )
#         .first()
#     )
#     if not template_record:
#         # No template enrolled — cannot verify. Be lenient (return verified=True).
#         logger.warning(
#             f"⚠️ No active template for session {request.session_id}. Skipping check."
#         )
#         return WiFiVerifyResponse(
#             verified=True,
#             similarity_score=0.0,
#             threshold=DEFAULT_THRESHOLD,
#             is_anomaly=False,
#             ap_count_current=len(request.scan),
#             ap_count_template=0,
#             common_aps=0,
#             total_aps=len(request.scan),
#             message="No Wi-Fi template enrolled — skipping check",
#         )

#     # 3. Deserialize the template and convert current scan to dicts
#     template_dict = template_from_json(template_record.template_data)
#     current_aps = [ap.model_dump() for ap in request.scan]

#     # 4. Run the JSR algorithm
#     result = verify_fingerprint(template_dict, current_aps)

#     logger.info(
#         f"📶 JSR result: score={result['jsr_score']}, "
#         f"verified={result['verified']}, anomaly={result['is_anomaly']}"
#     )

#     # 5. Update session stats
#     session.last_wifi_score = result["jsr_score"]
#     session.last_wifi_check = _utc_naive()
#     if result["verified"]:
#         session.wifi_verified_count = (session.wifi_verified_count or 0) + 1
#         # Reset failure counter on success
#         session.wifi_fail_count = 0
#     else:
#         session.wifi_fail_count = (session.wifi_fail_count or 0) + 1

#     # 6. Log the verification
#     verification = WiFiVerification(
#         session_id=session.id,
#         template_id=template_record.id,
#         student_id=session.student_id,
#         company_id=session.company_id,
#         fingerprint_data=fingerprint_to_json(current_aps),
#         ap_count=len(current_aps),
#         jsr_score=result["jsr_score"],
#         threshold=result["threshold"],
#         rssi_tolerance=template_record.rssi_tolerance,
#         is_match=result["verified"],
#         is_anomaly=result["is_anomaly"],
#         common_aps=result["common_aps"],
#         total_aps=result["total_aps"],
#         anomaly_reason=None if result["verified"] else result["message"],
#         checked_at=_utc_naive(),
#     )
#     db.add(verification)
#     db.flush()  # get verification.id for the event

#     # V2: emit verification_event
#     if settings.V2_WRITE_EVENTS:
#         db.add(VerificationEvent(
#             session_id=session.id,
#             layer=VerificationLayer.wifi,
#             event_type=VerificationEventType.success if result["verified"] else VerificationEventType.failure,
#             occurred_at=datetime.now(timezone.utc),
#             source_table="wifi_verifications",
#             source_id=verification.id,
#         ))

#     # 7. If anomaly, create or update an Anomaly record.
#     #
#     # Flaw #6: do NOT create a new Anomaly row per failed verify. One incident
#     # = one Anomaly row, from start to resolution.
#     anomaly_id = None
#     if result["is_anomaly"]:
#         if session.wifi_fail_count >= 2:
#             severity = "HIGH" if session.wifi_fail_count >= 4 else "MEDIUM"

#             existing_anomaly = (
#                 db.query(Anomaly)
#                 .filter(
#                     Anomaly.session_id == session.id,
#                     Anomaly.type == "environment_mismatch",
#                     Anomaly.resolved == False,
#                 )
#                 .order_by(Anomaly.id.desc())
#                 .first()
#             )

#             if existing_anomaly is not None:
#                 previous_severity = existing_anomaly.severity
#                 existing_anomaly.severity = severity

#                 note = (
#                     f"[{datetime.now(timezone.utc).isoformat(timespec='seconds')}] "
#                     f"JSR {result['jsr_score']:.2f} < {result['threshold']:.2f}, "
#                     f"fail_count={session.wifi_fail_count}, severity={severity}"
#                 )
#                 if existing_anomaly.description:
#                     existing_anomaly.description = (
#                         existing_anomaly.description + "\n" + note
#                     )
#                 else:
#                     existing_anomaly.description = note

#                 anomaly_id = existing_anomaly.id
#                 logger.warning(
#                     f"🔁 Anomaly updated (not duplicated): id={anomaly_id}, "
#                     f"session={request.session_id}, "
#                     f"severity {previous_severity} -> {severity}, "
#                     f"fail_count={session.wifi_fail_count}"
#                 )
#             else:
#                 anomaly = Anomaly(
#                     session_id=session.id,
#                     student_id=session.student_id,
#                     company_id=session.company_id,
#                     type="environment_mismatch",
#                     severity=severity,
#                     description=(
#                         f"Wi-Fi environment mismatch: JSR score {result['jsr_score']:.2f} "
#                         f"below threshold {result['threshold']:.2f}. "
#                         f"{session.wifi_fail_count} consecutive failures."
#                     ),
#                     resolved=False,
#                     status="open",  # V2 field
#                 )
#                 db.add(anomaly)
#                 db.flush()  # Get anomaly.id
#                 anomaly_id = anomaly.id
#                 logger.warning(
#                     f"🚨 Anomaly created: id={anomaly_id}, "
#                     f"session={request.session_id}, score={result['jsr_score']}, "
#                     f"severity={severity}"
#                 )
#         else:
#             logger.info(
#                 f"📶 First Wi-Fi failure ({session.wifi_fail_count}). "
#                 f"Waiting for second confirmation before flagging."
#             )

#     db.commit()

#     return WiFiVerifyResponse(
#         verified=result["verified"],
#         similarity_score=result["jsr_score"],
#         threshold=result["threshold"],
#         is_anomaly=result["is_anomaly"],
#         ap_count_current=len(current_aps),
#         ap_count_template=template_record.ap_count,
#         common_aps=result["common_aps"],
#         total_aps=result["total_aps"],
#         message=result["message"],
#         anomaly_id=anomaly_id,
#     )


# # ============================================================
# # INFO: Get template info for a session
# # ============================================================

# @router.get("/template/{session_id}", response_model=WiFiTemplateInfo)
# async def get_template_info(
#     session_id: str,
#     db: DBSession = Depends(get_db),
# ):
#     """
#     Get the active Wi-Fi template for a session.
#     Useful for admin debugging.
#     """
#     session = (
#         db.query(Session)
#         .filter(Session.session_id == session_id)
#         .first()
#     )
#     if not session:
#         raise HTTPException(status_code=404, detail="Session not found")

#     template = (
#         db.query(WiFiTemplate)
#         .filter(
#             WiFiTemplate.session_id == session.id,
#             WiFiTemplate.status == "active",
#         )
#         .first()
#     )
#     if not template:
#         raise HTTPException(status_code=404, detail="No active template for session")

#     return template


# # ============================================================
# # INFO: Get verification history for a session
# # ============================================================

# @router.get("/verifications/{session_id}", response_model=list[WiFiVerificationInfo])
# async def get_verification_history(
#     session_id: str,
#     limit: int = 50,
#     db: DBSession = Depends(get_db),
# ):
#     """
#     Get all Wi-Fi verifications for a session, newest first.
#     """
#     session = (
#         db.query(Session)
#         .filter(Session.session_id == session_id)
#         .first()
#     )
#     if not session:
#         raise HTTPException(status_code=404, detail="Session not found")

#     verifications = (
#         db.query(WiFiVerification)
#         .filter(WiFiVerification.session_id == session.id)
#         .order_by(WiFiVerification.checked_at.desc())
#         .limit(limit)
#         .all()
#     )

#     return verifications

# backend/app/api/routes/wifi.py
"""
Wi-Fi Fingerprinting API endpoints.

V2: emits verification_events for each verify call, and issues a
presence challenge when wifi_fail_count >= 2 (Phase 4).
"""
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session as DBSession
from datetime import datetime, timezone
import logging

from ...models import (
    Session, Student, Company, Anomaly, WiFiTemplate, WiFiVerification,
    VerificationEvent, VerificationLayer, VerificationEventType,
)
from ...core.database import get_db
from ...core.config import settings
from ...schemas.wifi import (
    WiFiEnrollRequest, WiFiEnrollResponse,
    WiFiVerifyRequest, WiFiVerifyResponse,
    WiFiTemplateInfo, WiFiVerificationInfo,
)
from ...services.wifi_fingerprint import (
    create_template, verify_fingerprint,
    template_to_json, template_from_json,
    fingerprint_to_json, fingerprint_from_json,
    DEFAULT_THRESHOLD, DEFAULT_RSSI_TOLERANCE,
)
from ...services.challenges import issue_challenge

router = APIRouter(prefix="/wifi", tags=["wifi"])
logger = logging.getLogger(__name__)


def _utc_naive() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


# ============================================================
# ENROLL
# ============================================================

@router.post("/enroll", response_model=WiFiEnrollResponse)
async def enroll_wifi_environment(request: WiFiEnrollRequest, db: DBSession = Depends(get_db)):
    logger.info(f"📶 Enroll request for session: {request.session_id}")
    session = db.query(Session).filter(
        Session.session_id == request.session_id, Session.status == "active"
    ).first()
    if not session:
        raise HTTPException(404, f"No active session found for session_id={request.session_id}")

    scans_as_dicts = [[ap.model_dump() for ap in scan] for scan in request.scans]
    template_result = create_template(scans=scans_as_dicts, rssi_tolerance=DEFAULT_RSSI_TOLERANCE)

    logger.info(f"📶 Template built: {template_result['ap_count']} APs, valid={template_result['is_valid']}")

    existing = db.query(WiFiTemplate).filter(WiFiTemplate.session_id == session.id).first()
    if existing:
        existing.status = "superseded"
        logger.info(f"📶 Superseded previous template id={existing.id}")

    new_template = WiFiTemplate(
        session_id=session.id, company_id=session.company_id, student_id=session.student_id,
        template_data=template_to_json(template_result),
        ap_count=template_result["ap_count"], threshold=template_result["threshold"],
        rssi_tolerance=template_result["rssi_tolerance"], status="active",
        is_valid=template_result["is_valid"], captured_at=_utc_naive(),
    )
    db.add(new_template)

    session.has_wifi_template = True
    session.last_wifi_check = _utc_naive()
    session.last_wifi_score = None

    db.commit()
    db.refresh(new_template)
    logger.info(f"✅ Template created: id={new_template.id}")

    return WiFiEnrollResponse(
        success=True, message=template_result["message"],
        template_id=new_template.id, ap_count=new_template.ap_count,
        threshold=new_template.threshold, is_valid=new_template.is_valid,
    )


# ============================================================
# VERIFY
# ============================================================

@router.post("/verify", response_model=WiFiVerifyResponse)
async def verify_wifi_environment(request: WiFiVerifyRequest, db: DBSession = Depends(get_db)):
    logger.info(f"📶 Verify request for session: {request.session_id}")
    session = db.query(Session).filter(
        Session.session_id == request.session_id, Session.status == "active"
    ).first()
    if not session:
        raise HTTPException(404, f"No active session found for session_id={request.session_id}")

    template_record = db.query(WiFiTemplate).filter(
        WiFiTemplate.session_id == session.id, WiFiTemplate.status == "active"
    ).first()
    if not template_record:
        logger.warning(f"⚠️ No active template for session {request.session_id}. Skipping check.")
        return WiFiVerifyResponse(
            verified=True, similarity_score=0.0, threshold=DEFAULT_THRESHOLD,
            is_anomaly=False, ap_count_current=len(request.scan),
            ap_count_template=0, common_aps=0, total_aps=len(request.scan),
            message="No Wi-Fi template enrolled — skipping check",
        )

    template_dict = template_from_json(template_record.template_data)
    current_aps = [ap.model_dump() for ap in request.scan]
    result = verify_fingerprint(template_dict, current_aps)

    logger.info(
        f"📶 JSR result: score={result['jsr_score']}, "
        f"verified={result['verified']}, anomaly={result['is_anomaly']}"
    )

    session.last_wifi_score = result["jsr_score"]
    session.last_wifi_check = _utc_naive()
    if result["verified"]:
        session.wifi_verified_count = (session.wifi_verified_count or 0) + 1
        session.wifi_fail_count = 0
    else:
        session.wifi_fail_count = (session.wifi_fail_count or 0) + 1

    verification = WiFiVerification(
        session_id=session.id, template_id=template_record.id,
        student_id=session.student_id, company_id=session.company_id,
        fingerprint_data=fingerprint_to_json(current_aps), ap_count=len(current_aps),
        jsr_score=result["jsr_score"], threshold=result["threshold"],
        rssi_tolerance=template_record.rssi_tolerance,
        is_match=result["verified"], is_anomaly=result["is_anomaly"],
        common_aps=result["common_aps"], total_aps=result["total_aps"],
        anomaly_reason=None if result["verified"] else result["message"],
        checked_at=_utc_naive(),
    )
    db.add(verification)
    db.flush()

    if settings.V2_WRITE_EVENTS:
        db.add(VerificationEvent(
            session_id=session.id,
            layer=VerificationLayer.wifi,
            event_type=VerificationEventType.success if result["verified"] else VerificationEventType.failure,
            occurred_at=datetime.now(timezone.utc),
            source_table="wifi_verifications",
            source_id=verification.id,
        ))

    anomaly_id = None
    if result["is_anomaly"]:
        if session.wifi_fail_count >= 2:
            severity = "HIGH" if session.wifi_fail_count >= 4 else "MEDIUM"

            existing_anomaly = db.query(Anomaly).filter(
                Anomaly.session_id == session.id,
                Anomaly.type == "environment_mismatch",
                Anomaly.resolved == False,
            ).order_by(Anomaly.id.desc()).first()

            if existing_anomaly is not None:
                previous_severity = existing_anomaly.severity
                existing_anomaly.severity = severity
                note = (
                    f"[{datetime.now(timezone.utc).isoformat(timespec='seconds')}] "
                    f"JSR {result['jsr_score']:.2f} < {result['threshold']:.2f}, "
                    f"fail_count={session.wifi_fail_count}, severity={severity}"
                )
                if existing_anomaly.description:
                    existing_anomaly.description = existing_anomaly.description + "\n" + note
                else:
                    existing_anomaly.description = note
                anomaly_id = existing_anomaly.id
                logger.warning(
                    f"🔁 Anomaly updated (not duplicated): id={anomaly_id}, "
                    f"severity {previous_severity} -> {severity}, "
                    f"fail_count={session.wifi_fail_count}"
                )
            else:
                anomaly = Anomaly(
                    session_id=session.id, student_id=session.student_id, company_id=session.company_id,
                    type="environment_mismatch", severity=severity,
                    description=(
                        f"Wi-Fi environment mismatch: JSR score {result['jsr_score']:.2f} "
                        f"below threshold {result['threshold']:.2f}. "
                        f"{session.wifi_fail_count} consecutive failures."
                    ),
                    resolved=False, status="open",
                )
                db.add(anomaly)
                db.flush()
                anomaly_id = anomaly.id
                logger.warning(f"🚨 Anomaly created: id={anomaly_id}, severity={severity}")

            # ---- Phase 4: issue presence challenge (idempotent) ----
            try:
                issue_challenge(db, session, reason="wifi_fail_escalation")
            except Exception as e:
                logger.error(f"⚠️ Could not issue challenge (non-fatal): {e}")
        else:
            logger.info(
                f"📶 First Wi-Fi failure ({session.wifi_fail_count}). "
                f"Waiting for second confirmation before flagging."
            )

    db.commit()

    return WiFiVerifyResponse(
        verified=result["verified"], similarity_score=result["jsr_score"],
        threshold=result["threshold"], is_anomaly=result["is_anomaly"],
        ap_count_current=len(current_aps), ap_count_template=template_record.ap_count,
        common_aps=result["common_aps"], total_aps=result["total_aps"],
        message=result["message"], anomaly_id=anomaly_id,
    )


# ============================================================
# INFO endpoints
# ============================================================

@router.get("/template/{session_id}", response_model=WiFiTemplateInfo)
async def get_template_info(session_id: str, db: DBSession = Depends(get_db)):
    session = db.query(Session).filter(Session.session_id == session_id).first()
    if not session:
        raise HTTPException(404, "Session not found")
    template = db.query(WiFiTemplate).filter(
        WiFiTemplate.session_id == session.id, WiFiTemplate.status == "active"
    ).first()
    if not template:
        raise HTTPException(404, "No active template for session")
    return template


@router.get("/verifications/{session_id}", response_model=list[WiFiVerificationInfo])
async def get_verification_history(session_id: str, limit: int = 50, db: DBSession = Depends(get_db)):
    session = db.query(Session).filter(Session.session_id == session_id).first()
    if not session:
        raise HTTPException(404, "Session not found")
    return db.query(WiFiVerification).filter(
        WiFiVerification.session_id == session.id
    ).order_by(WiFiVerification.checked_at.desc()).limit(limit).all()