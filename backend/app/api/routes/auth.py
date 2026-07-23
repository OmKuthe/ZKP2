# backend/app/api/routes/auth.py
"""
Admin Authentication
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from datetime import datetime, timedelta
import jwt
import os

router = APIRouter(prefix="/auth", tags=["auth"])

# Hardcoded admin credentials
ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "admin@123"

class LoginRequest(BaseModel):
    username: str
    password: str

class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str

@router.post("/login", response_model=LoginResponse)
async def admin_login(request: LoginRequest):
    """Admin login with hardcoded credentials"""
    if request.username != ADMIN_USERNAME or request.password != ADMIN_PASSWORD:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Create JWT token
    token_data = {
        "username": request.username,
        "role": "admin",
        "exp": datetime.utcnow() + timedelta(hours=24)
    }
    
    token = jwt.encode(token_data, os.getenv("JWT_SECRET", "dev-secret"), algorithm="HS256")
    
    return LoginResponse(
        access_token=token,
        role="admin"
    )