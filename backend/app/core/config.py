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


settings = Settings()