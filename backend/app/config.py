import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./zkattend.db")
    CORS_ORIGINS = os.getenv("CORS_ORIGINS", '["http://localhost:5173"]')
    ENVIRONMENT = os.getenv("ENVIRONMENT", "development")
    DEBUG = os.getenv("DEBUG", "True").lower() == "true"
    
    # Testing Mode Settings
    TESTING_MODE = os.getenv("TESTING_MODE", "True").lower() == "true"
    DEMO_MODE = os.getenv("DEMO_MODE", "True").lower() == "true"  # For presentation
    PROOF_INTERVAL_SECONDS = int(os.getenv("PROOF_INTERVAL_SECONDS", "60"))  # 60 seconds = 1 min
    SESSION_DURATION_MINUTES = int(os.getenv("SESSION_DURATION_MINUTES", "10"))  # 10 min demo
    
    # QR Service Settings (Phase 2)
    REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    QR_MASTER_SECRET = os.getenv("QR_MASTER_SECRET", "change-this-in-production-secret-key")
    QR_CHALLENGE_TTL = int(os.getenv("QR_CHALLENGE_TTL", "30"))  # 30 seconds for TOTP-style challenges
    
settings = Settings()