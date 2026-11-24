# backend/app/core/config.py
"""
Configuration for the backend.
Loads environment variables.
"""
import os
from dotenv import load_dotenv

load_dotenv()


class Settings:
    """Application settings"""

    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./zkattend.db")

    # Security
    JWT_SECRET: str = os.getenv("JWT_SECRET", "dev-secret-change-me")
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRY_HOURS: int = 24

    # QR
    QR_MASTER_SECRET: str = os.getenv("QR_MASTER_SECRET", "dev-qr-secret")
    QR_CHALLENGE_TTL: int = 30  # seconds

    # App
    APP_NAME: str = "ZKAttend Phase 2A"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = os.getenv("DEBUG", "True").lower() == "true"

    # ---------- V2 additions ----------
    DEFAULT_COMPANY_TZ: str = os.getenv("DEFAULT_COMPANY_TZ", "Asia/Kolkata")
    REVERIFY_TIMEOUT_MIN: int = int(os.getenv("REVERIFY_TIMEOUT_MIN", "5"))
    V2_WRITE_EVENTS: bool = os.getenv("V2_WRITE_EVENTS", "true").lower() == "true"
    V2_CHALLENGES_ENABLED: bool = os.getenv("V2_CHALLENGES_ENABLED", "false").lower() == "true"
    V2_CHALLENGE_INTERVAL_MIN: int = int(os.getenv("V2_CHALLENGE_INTERVAL_MIN", "20"))
    V2_CHALLENGE_JITTER_MIN: int = int(os.getenv("V2_CHALLENGE_JITTER_MIN", "5"))

    # ---------- V2 Phase 4 additions ----------
    V2_CHALLENGE_SWEEP_INTERVAL_SEC: int = int(os.getenv("V2_CHALLENGE_SWEEP_INTERVAL_SEC", "30"))
    EXPO_PUSH_URL: str = os.getenv("EXPO_PUSH_URL", "https://exp.host/--/api/v2/push/send")


settings = Settings()