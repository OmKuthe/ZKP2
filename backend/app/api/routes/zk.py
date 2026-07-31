# backend/app/api/routes/zk.py
"""
ZKP endpoints - Phase 3A
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any
import json
import os

from ...zk.verifier import get_verifier

router = APIRouter(prefix="/zk", tags=["zk"])


class VerifyProofRequest(BaseModel):
    proof: Dict[str, Any]
    public_signals: List[str]


class VerifyProofResponse(BaseModel):
    valid: bool
    message: str


@router.get("/verification-key")
async def get_verification_key():
    """Get the verification key for the QR circuit"""
    key_path = os.path.join(os.path.dirname(__file__), '..', '..', 'zk', 'verification_key.json')
    try:
        with open(key_path, 'r') as f:
            return json.load(f)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Verification key not found")


@router.post("/verify", response_model=VerifyProofResponse)
async def verify_proof(request: VerifyProofRequest):
    """Verify a ZKP"""
    verifier = get_verifier()
    is_valid, message = verifier.verify_proof(
        request.proof,
        request.public_signals
    )
    return VerifyProofResponse(valid=is_valid, message=message)