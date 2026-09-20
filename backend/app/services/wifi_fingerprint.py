# backend/app/services/wifi_fingerprint.py
"""
Wi-Fi Fingerprinting Service
Implements the Jaccard Similarity with RSSI (JSR) algorithm.

Reference:
    Jakubeit, Peter, Andreas Peter, and Maarten van Steen.
    "The Measurable Environment as Nonintrusive Authentication Factor
    on the Example of WiFi Beacon Frames."
    University of Twente.

The core algorithm:
    JSR(F, T) = |APR(F) ∩ APR(T)| / |APR(F) ∪ APR(T)|

Where:
    - T is a template (multiple scans of the same environment).
    - F is a fingerprint (a single scan).
    - APR(·) is the set of Access Point Representations.
    - Intersection uses RSSI tolerance: two APs match if their
      capability features align AND their RSSI difference <= tolerance.
"""
import json
import logging
from typing import List, Dict, Tuple, Optional
from datetime import datetime

logger = logging.getLogger(__name__)


# ============================================================
# Constants
# ============================================================

# RSSI normalization range (in dBm)
RSSI_MIN = -100.0   # Very far
RSSI_MAX = -30.0    # Very close

# Default parameters from the paper
DEFAULT_THRESHOLD = 0.7          # Similarity threshold for "same location"
DEFAULT_RSSI_TOLERANCE = 0.1     # Max RSSI difference after normalization
MIN_APS_FOR_VALID_TEMPLATE = 6   # Per the paper: at least 6 APs for reliability

# Maximum number of APs we keep in a template (avoid huge payloads)
MAX_TEMPLATE_APS = 50


# ============================================================
# Helper: RSSI Normalization
# ============================================================

def normalize_rssi(rssi: float) -> float:
    """
    Normalize an RSSI value (dBm) to [0, 1].
    
    -30 dBm (strong) -> 1.0
    -100 dBm (weak)  -> 0.0
    """
    if rssi is None:
        return 0.0
    normalized = (rssi - RSSI_MIN) / (RSSI_MAX - RSSI_MIN)
    # Clamp to [0, 1]
    return max(0.0, min(1.0, normalized))


# ============================================================
# Helper: Build APR key from a scan entry
# ============================================================

def _apr_key(ap: Dict) -> str:
    """
    The "identity" of an AP: its BSSID (MAC address).
    Two APs from the same device (same BSSID) are "the same AP".
    
    Note: In a privacy-hardened version, this could be a salted hash
    of the BSSID. For now, we use the raw BSSID (transmitted over TLS).
    """
    return (ap.get("bssid") or "").upper()


def _apr_features(ap: Dict) -> str:
    """
    Capability features of an AP. Combined with RSSI, this determines
    if two APRs match.
    """
    return (ap.get("capabilities") or "").strip()


# ============================================================
# Template Creation
# ============================================================

def create_template(
    scans: List[List[Dict]],
    rssi_tolerance: float = DEFAULT_RSSI_TOLERANCE,
    min_aps: int = MIN_APS_FOR_VALID_TEMPLATE,
) -> Dict:
    """
    Build a Wi-Fi fingerprint template from multiple scans.
    
    Aggregation strategy:
        For each AP seen across all scans, keep:
          - the median RSSI
          - the most common capabilities/frequency
          - the number of times it was seen
    
    Args:
        scans: List of scans. Each scan is a list of AP dicts.
        rssi_tolerance: Max RSSI difference for two APs to be considered "same".
        min_aps: Minimum number of APs needed for a "valid" template.
    
    Returns:
        A dict with:
            - aps: List of consolidated APRs
            - threshold: Computed similarity threshold
            - rssi_tolerance: d(F) parameter
            - is_valid: Boolean flag
            - message: Explanation
    """
    if not scans:
        return {
            "aps": [],
            "threshold": DEFAULT_THRESHOLD,
            "rssi_tolerance": rssi_tolerance,
            "is_valid": False,
            "ap_count": 0,
            "message": "No scans provided",
        }

    # ---------------------------------------------------------
    # Aggregate: for each BSSID, collect all (rssi, features) pairs
    # ---------------------------------------------------------
    # bssid -> {
    #     "rssi_values": [float, ...],
    #     "capabilities": set of strings,
    #     "frequencies": set of ints,
    #     "ssids": set of strings,
    #     "seen_count": int,
    # }
    aggregate: Dict[str, Dict] = {}

    for scan in scans:
        for ap in scan:
            key = _apr_key(ap)
            if not key:
                continue  # Skip entries without BSSID

            if key not in aggregate:
                aggregate[key] = {
                    "rssi_values": [],
                    "capabilities": set(),
                    "frequencies": set(),
                    "ssids": set(),
                    "seen_count": 0,
                }

            entry = aggregate[key]
            rssi = ap.get("rssi")
            if rssi is not None:
                entry["rssi_values"].append(float(rssi))

            caps = ap.get("capabilities")
            if caps:
                entry["capabilities"].add(caps.strip())

            freq = ap.get("frequency")
            if freq:
                entry["frequencies"].add(int(freq))

            ssid = ap.get("ssid")
            if ssid:
                entry["ssids"].add(ssid)

            entry["seen_count"] += 1

    # ---------------------------------------------------------
    # Consolidate: reduce each BSSID entry to a single APR
    # ---------------------------------------------------------
    consolidated: List[Dict] = []

    for bssid, data in aggregate.items():
        rssi_values = data["rssi_values"]
        if not rssi_values:
            continue

        # Median RSSI is more robust to outliers than mean
        rssi_values_sorted = sorted(rssi_values)
        median_idx = len(rssi_values_sorted) // 2
        median_rssi = rssi_values_sorted[median_idx]

        # Most common capabilities (or empty)
        capabilities = ""
        if data["capabilities"]:
            capabilities = sorted(data["capabilities"])[0]

        # Most common frequency (or None)
        frequency = None
        if data["frequencies"]:
            frequency = sorted(data["frequencies"])[0]

        consolidated.append({
            "bssid": bssid,
            "rssi": median_rssi,
            "rssi_normalized": normalize_rssi(median_rssi),
            "capabilities": capabilities,
            "frequency": frequency,
            "seen_count": data["seen_count"],
        })

    # Sort by strongest signal first, and trim to MAX_TEMPLATE_APS
    consolidated.sort(key=lambda a: a["rssi"], reverse=True)
    consolidated = consolidated[:MAX_TEMPLATE_APS]

    ap_count = len(consolidated)
    is_valid = ap_count >= min_aps

    # ---------------------------------------------------------
    # Compute threshold
    # ---------------------------------------------------------
    # Simplified threshold estimation:
    #   - "Local similarity" = how similar are APs within the template?
    #   - "Remote similarity" = a conservative estimate (0.3).
    #
    # For simplicity, we use:
    #   threshold = max(DEFAULT_THRESHOLD, mid_point)
    #
    # In practice, you could compute the actual local similarity
    # by comparing fingerprints within the template — but that's an
    # optimization we can add later.
    threshold = DEFAULT_THRESHOLD

    message = (
        f"Template created with {ap_count} APs. "
        f"{'Valid' if is_valid else f'INVALID — need at least {min_aps} APs'}."
    )

    logger.info(f"📶 Template: {message}")

    return {
        "aps": consolidated,
        "threshold": threshold,
        "rssi_tolerance": rssi_tolerance,
        "is_valid": is_valid,
        "ap_count": ap_count,
        "message": message,
    }


# ============================================================
# JSR Algorithm — THE CORE
# ============================================================

def calculate_jsr(
    template_aps: List[Dict],
    current_aps: List[Dict],
    rssi_tolerance: float = DEFAULT_RSSI_TOLERANCE,
) -> Dict:
    """
    Calculate the Jaccard Similarity with RSSI (JSR) between a
    template and a current fingerprint.
    
    Formula:
        JSR = |Intersection| / |Union|
    
    Where:
        - Intersection: APs present in BOTH, with matching capability
          features AND RSSI difference <= tolerance.
        - Union: All unique APs from EITHER set.
    
    Args:
        template_aps: The list of APRs from the template.
        current_aps: The list of APRs from the current scan.
        rssi_tolerance: d(F) — max normalized RSSI difference for a match.
    
    Returns:
        {
            "jsr_score": float,
            "common_aps": int,
            "total_aps": int,
            "matched_details": [...],  # For debugging
        }
    """
    if not template_aps or not current_aps:
        return {
            "jsr_score": 0.0,
            "common_aps": 0,
            "total_aps": max(len(template_aps), len(current_aps)),
            "matched_details": [],
            "message": "Empty template or fingerprint",
        }

    # ---------------------------------------------------------
    # Build lookup by BSSID for O(1) matching
    # ---------------------------------------------------------
    template_index = {_apr_key(ap): ap for ap in template_aps}
    current_index = {_apr_key(ap): ap for ap in current_aps}

    # ---------------------------------------------------------
    # Compute intersection
    # ---------------------------------------------------------
    # An AP is in the intersection if:
    #   1. Its BSSID appears in both template and current scan.
    #   2. Its capability features match.
    #   3. Its normalized RSSI difference <= rssi_tolerance.
    # ---------------------------------------------------------
    intersection: List[str] = []
    matched_details: List[Dict] = []

    for bssid, t_ap in template_index.items():
        c_ap = current_index.get(bssid)
        if not c_ap:
            continue  # AP not seen in current scan

        # Compare capabilities (must match)
        t_caps = _apr_features(t_ap)
        c_caps = _apr_features(c_ap)
        if t_caps and c_caps and t_caps != c_caps:
            continue  # Same AP but different capabilities — treat as different

        # Compare RSSI within tolerance
        t_rssi_norm = t_ap.get("rssi_normalized")
        if t_rssi_norm is None:
            t_rssi_norm = normalize_rssi(t_ap.get("rssi", RSSI_MIN))

        c_rssi_norm = c_ap.get("rssi_normalized")
        if c_rssi_norm is None:
            c_rssi_norm = normalize_rssi(c_ap.get("rssi", RSSI_MIN))

        rssi_diff = abs(t_rssi_norm - c_rssi_norm)

        if rssi_diff <= rssi_tolerance:
            intersection.append(bssid)
            matched_details.append({
                "bssid": bssid,
                "template_rssi": t_ap.get("rssi"),
                "current_rssi": c_ap.get("rssi"),
                "rssi_diff": round(rssi_diff, 4),
            })

    # ---------------------------------------------------------
    # Compute union
    # ---------------------------------------------------------
    all_bssids = set(template_index.keys()) | set(current_index.keys())
    union_count = len(all_bssids)

    # ---------------------------------------------------------
    # Compute JSR
    # ---------------------------------------------------------
    if union_count == 0:
        jsr_score = 0.0
    else:
        jsr_score = len(intersection) / union_count

    return {
        "jsr_score": round(jsr_score, 4),
        "common_aps": len(intersection),
        "total_aps": union_count,
        "matched_details": matched_details,
        "message": (
            f"{len(intersection)} APs match out of {union_count} total"
        ),
    }


# ============================================================
# High-level: Verify a fingerprint against a template
# ============================================================

def verify_fingerprint(
    template: Dict,
    current_aps: List[Dict],
) -> Dict:
    """
    High-level verification.
    
    Takes a template dict (as returned by `create_template`) and a
    list of current APRs, computes JSR, and decides match/anomaly.
    
    Returns:
        {
            "verified": bool,
            "is_anomaly": bool,
            "jsr_score": float,
            "threshold": float,
            "common_aps": int,
            "total_aps": int,
            "message": str,
        }
    """
    template_aps = template.get("aps", [])
    threshold = template.get("threshold", DEFAULT_THRESHOLD)
    rssi_tolerance = template.get("rssi_tolerance", DEFAULT_RSSI_TOLERANCE)

    # If the template is invalid, we don't flag anomalies
    if not template.get("is_valid", True):
        return {
            "verified": True,           # Be lenient if template is bad
            "is_anomaly": False,
            "jsr_score": 0.0,
            "threshold": threshold,
            "common_aps": 0,
            "total_aps": 0,
            "message": "Template is invalid — skipping Wi-Fi check",
        }

    # Compute JSR
    jsr_result = calculate_jsr(template_aps, current_aps, rssi_tolerance)
    jsr_score = jsr_result["jsr_score"]

    # Decide
    is_match = jsr_score >= threshold
    is_anomaly = not is_match

    if is_match:
        message = (
            f"Wi-Fi matches template (score {jsr_score:.2f} ≥ {threshold:.2f})"
        )
    else:
        message = (
            f"Wi-Fi deviates from template (score {jsr_score:.2f} < {threshold:.2f})"
        )

    logger.info(f"📶 JSR result: {message}")

    return {
        "verified": is_match,
        "is_anomaly": is_anomaly,
        "jsr_score": jsr_score,
        "threshold": threshold,
        "common_aps": jsr_result["common_aps"],
        "total_aps": jsr_result["total_aps"],
        "message": message,
        "matched_details": jsr_result["matched_details"],
    }


# ============================================================
# Serialization Helpers
# ============================================================

def template_to_json(template: Dict) -> str:
    """Serialize a template dict to a JSON string for DB storage."""
    return json.dumps(template, default=str)


def template_from_json(json_str: str) -> Dict:
    """Deserialize a template JSON string back to a dict."""
    if not json_str:
        return {}
    try:
        return json.loads(json_str)
    except Exception as e:
        logger.error(f"Failed to parse template JSON: {e}")
        return {}


def fingerprint_to_json(aps: List[Dict]) -> str:
    """Serialize a list of current APRs to JSON for storage."""
    return json.dumps(aps, default=str)


def fingerprint_from_json(json_str: str) -> List[Dict]:
    """Deserialize a fingerprint JSON string back to a list."""
    if not json_str:
        return []
    try:
        return json.loads(json_str)
    except Exception as e:
        logger.error(f"Failed to parse fingerprint JSON: {e}")
        return []