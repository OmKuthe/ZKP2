# backend/app/zk/__init__.py
from .verifier import get_verifier, QRProofVerifier
# app/zk/__init__.py
from .proof_generator import generate_and_verify_proximity_proof


__all__ = [
    'get_verifier',
    'QRProofVerifier',
    'generate_qr_proof',
    'generate_and_verify_proximity_proof',
]