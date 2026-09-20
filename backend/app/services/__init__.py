# backend/app/services/__init__.py
from .qr_service import QRService, QRChallenge, QRVerificationResult
from .hash_chain import HashChainService
from .push_scheduler import PushScheduler
from .wifi_fingerprint import (          # ✅ NEW
    create_template,
    calculate_jsr,
    verify_fingerprint,
    template_to_json,
    template_from_json,
    fingerprint_to_json,
    fingerprint_from_json,
    normalize_rssi,
    DEFAULT_THRESHOLD,
    DEFAULT_RSSI_TOLERANCE,
    MIN_APS_FOR_VALID_TEMPLATE,
)

__all__ = [
    'QRService',
    'QRChallenge',
    'QRVerificationResult',
    'HashChainService',
    'PushScheduler',
    # ✅ Wi-Fi Fingerprinting
    'create_template',
    'calculate_jsr',
    'verify_fingerprint',
    'template_to_json',
    'template_from_json',
    'fingerprint_to_json',
    'fingerprint_from_json',
    'normalize_rssi',
    'DEFAULT_THRESHOLD',
    'DEFAULT_RSSI_TOLERANCE',
    'MIN_APS_FOR_VALID_TEMPLATE',
]