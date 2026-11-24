#!/usr/bin/env python3
"""
Quick diagnostic: compare each V2-migrated table's actual columns (from
SQLite) against the SQLAlchemy model's declared columns. Any column in
the DB that isn't on the model is a latent AttributeError waiting to
happen. Run after every migration or model change.

Usage: python scripts/check_v2_columns.py
"""
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.dirname(os.path.dirname(__file__))))

import sqlite3
from app.core.database import engine
from app.models import (
    Company, Student, Session, Anomaly, Internship, InternshipAssignment,
    WiFiTemplate, WiFiVerification, ContinuityCheck,
    User, StudentProfile, Device, ZkpVerification, FaceVerification,
    VerificationEvent, PresenceChallenge, AuditLog,
)

MODEL_TO_TABLE = {
    Company: "companies",
    Student: "students",
    Session: "sessions",
    Anomaly: "anomalies",
    Internship: "internships",
    InternshipAssignment: "internship_assignments",
    WiFiTemplate: "wifi_templates",
    WiFiVerification: "wifi_verifications",
    ContinuityCheck: "heartbeats",
    User: "users",
    StudentProfile: "student_profiles",
    Device: "devices",
    ZkpVerification: "zkp_verifications",
    FaceVerification: "face_verifications",
    VerificationEvent: "verification_events",
    PresenceChallenge: "presence_challenges",
    AuditLog: "audit_log",
}


def main():
    db_path = str(engine.url).replace("sqlite:///", "").replace("./", "")
    if not os.path.exists(db_path):
        print(f"❌ DB not found: {db_path}")
        sys.exit(1)

    conn = sqlite3.connect(db_path)
    problems = 0

    for model, table in MODEL_TO_TABLE.items():
        try:
            db_cols = {r[1] for r in conn.execute(f"PRAGMA table_info({table})")}
        except Exception as e:
            print(f"❓ {table}: could not read — {e}")
            continue

        model_cols = {c.name for c in model.__table__.columns}
        missing_on_model = db_cols - model_cols

        if missing_on_model:
            problems += 1
            print(f"❌ {table}: model missing columns -> {sorted(missing_on_model)}")
        else:
            print(f"✅ {table}: OK ({len(db_cols)} cols)")

    conn.close()
    sys.exit(0 if problems == 0 else 2)


if __name__ == "__main__":
    main()