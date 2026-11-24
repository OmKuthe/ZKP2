# backend/app/api/routes/v2_bulk.py
"""
Bulk student creation via CSV upload.

POST /api/v2/students/bulk
    - Accepts multipart/form-data with a single `file` field
    - Parses CSV using stdlib csv.DictReader
    - Required columns: student_id, name, email
    - Optional columns: company_id (ignored if absent/invalid)
    - Password column is ignored — all new students get "password123"
    - Per-row results returned; the operation is not atomic
      (successful rows are committed even if later rows fail)

Response:
{
  "total": 10,
  "created": 8,
  "skipped": 1,
  "errors": 1,
  "results": [
    {"row": 2, "status": "created", "student_id": "S001", "id": 6},
    {"row": 3, "status": "skipped", "student_id": "S002", "reason": "student_id already exists"},
    {"row": 4, "status": "error",   "reason": "missing required column: email"}
  ]
}
"""
from __future__ import annotations

import csv
import io
import logging
import re
from typing import Optional

import bcrypt
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session as DBSession

from ...models import Student
from ...core.database import get_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v2/students", tags=["v2-bulk"])

DEFAULT_PASSWORD = "password123"
REQUIRED_COLUMNS = {"student_id", "name", "email"}
EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
MAX_ROWS = 500


class BulkRowResult(BaseModel):
    row: int
    status: str            # "created" | "skipped" | "error"
    student_id: Optional[str] = None
    id: Optional[int] = None
    reason: Optional[str] = None


class BulkUploadResponse(BaseModel):
    total: int
    created: int
    skipped: int
    errors: int
    results: list[BulkRowResult]


@router.post("/bulk", response_model=BulkUploadResponse)
async def bulk_create_students(
    file: UploadFile = File(..., description="CSV file with student_id,name,email[,company_id]"),
    db: DBSession = Depends(get_db),
):
    """
    Bulk-create students from a CSV file. Password column is ignored;
    all new students get DEFAULT_PASSWORD. Duplicate student_ids are
    skipped (not errors). Invalid rows are reported as errors.
    """
    # ---- 1. Read + validate file type ----
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="File must be a .csv")

    try:
        content = await file.read()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not read file: {e}")

    if len(content) > 2 * 1024 * 1024:  # 2 MB cap
        raise HTTPException(status_code=400, detail="File too large (max 2 MB)")

    try:
        text = content.decode("utf-8-sig")  # handles BOM from Excel-saved CSVs
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="File must be UTF-8 encoded CSV")

    # ---- 2. Parse CSV ----
    try:
        reader = csv.DictReader(io.StringIO(text))
        if reader.fieldnames is None:
            raise HTTPException(status_code=400, detail="CSV has no header row")

        # Normalize headers (strip, lowercase)
        reader.fieldnames = [h.strip().lower() for h in reader.fieldnames]

        missing = REQUIRED_COLUMNS - set(reader.fieldnames)
        if missing:
            raise HTTPException(
                status_code=400,
                detail=f"CSV is missing required column(s): {', '.join(sorted(missing))}. "
                       f"Required: student_id, name, email",
            )

        rows = list(reader)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid CSV: {e}")

    if not rows:
        raise HTTPException(status_code=400, detail="CSV has no data rows")

    if len(rows) > MAX_ROWS:
        raise HTTPException(status_code=400, detail=f"Too many rows ({len(rows)}); max is {MAX_ROWS}")

    # ---- 3. Hash password ONCE (same for all rows) ----
    try:
        shared_hash = bcrypt.hashpw(DEFAULT_PASSWORD.encode(), bcrypt.gensalt()).decode()
    except Exception as e:
        logger.exception("bcrypt failed")
        raise HTTPException(status_code=500, detail=f"Password hashing failed: {e}")

    # ---- 4. Process rows ----
    results: list[BulkRowResult] = []
    created = 0
    skipped = 0
    errors = 0

    for idx, row in enumerate(rows, start=2):  # start=2 → first data row is row 2 (header is row 1)
        sid = (row.get("student_id") or "").strip()
        name = (row.get("name") or "").strip()
        email = (row.get("email") or "").strip()
        company_id_raw = (row.get("company_id") or "").strip()

        # Empty row → skip silently with no error
        if not sid and not name and not email:
            continue

        # Validate required fields
        if not sid:
            results.append(BulkRowResult(row=idx, status="error", reason="missing student_id"))
            errors += 1
            continue
        if not name:
            results.append(BulkRowResult(row=idx, status="error", student_id=sid, reason="missing name"))
            errors += 1
            continue
        if not email:
            results.append(BulkRowResult(row=idx, status="error", student_id=sid, reason="missing email"))
            errors += 1
            continue

        if not EMAIL_RE.match(email):
            results.append(BulkRowResult(row=idx, status="error", student_id=sid, reason=f"invalid email: {email}"))
            errors += 1
            continue

        # company_id: optional, ignore if invalid
        company_id = None
        if company_id_raw:
            try:
                company_id = int(company_id_raw)
            except ValueError:
                company_id = None  # ignore silently — not fatal

        # Duplicate check (student_id OR email)
        existing = (
            db.query(Student)
            .filter((Student.student_id == sid) | (Student.email == email))
            .first()
        )
        if existing:
            reason = "student_id already exists" if existing.student_id == sid else "email already exists"
            results.append(BulkRowResult(row=idx, status="skipped", student_id=sid, reason=reason))
            skipped += 1
            continue

        # Insert
        try:
            student = Student(
                student_id=sid,
                name=name,
                email=email,
                password_hash=shared_hash,
                company_id=company_id,
                is_active=True,
            )
            db.add(student)
            db.flush()  # get id
            results.append(BulkRowResult(
                row=idx, status="created", student_id=sid, id=student.id,
            ))
            created += 1
        except IntegrityError as e:
            db.rollback()
            results.append(BulkRowResult(
                row=idx, status="error", student_id=sid,
                reason=f"database constraint: {str(e.orig)[:100]}",
            ))
            errors += 1
        except Exception as e:
            db.rollback()
            results.append(BulkRowResult(
                row=idx, status="error", student_id=sid,
                reason=f"unexpected error: {str(e)[:100]}",
            ))
            errors += 1

    # ---- 5. Commit successes ----
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        logger.exception("bulk commit failed")
        raise HTTPException(status_code=500, detail=f"Commit failed: {e}")

    logger.info(f"Bulk upload: total={len(rows)} created={created} skipped={skipped} errors={errors}")

    return BulkUploadResponse(
        total=len(rows),
        created=created,
        skipped=skipped,
        errors=errors,
        results=results,
    )