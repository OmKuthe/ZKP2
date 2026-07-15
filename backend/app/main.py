from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from .database import init_db, AsyncSessionLocal
from .api import auth, admin, manager, student
from .utils._init_db import init_default_data
from datetime import datetime

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create tables and init default data
    await init_db()
    async with AsyncSessionLocal() as db:
        await init_default_data(db)
    print("✅ Database initialized with default data")
    yield
    # Shutdown cleanup
    print("👋 Shutting down...")

app = FastAPI(
    title="ZKAttend - Internship Attendance System",
    description="Zero-Knowledge Proof based attendance tracking for internships",
    version="3.0.0",
    lifespan=lifespan
)

# CORS configuration - FIXED
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000","*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Include routers
app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(manager.router)
app.include_router(student.router)

@app.get("/")
async def root():
    return {
        "message": "ZKAttend Internship Attendance System",
        "version": "3.0.0",
        "status": "running"
    }

@app.get("/health")
async def health():
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}