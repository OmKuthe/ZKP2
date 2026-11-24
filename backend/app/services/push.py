# backend/app/services/push.py
"""
Expo push notification client.

Docs: https://docs.expo.dev/push-notifications/sending-notifications/

Phase 4 scope:
- Send a single push to a single Expo push token.
- Fire-and-forget: 200 = Expo accepted. Device delivery is asynchronous
  and we don't process receipts (deferred to future phase).
- All failures are logged but never raised — the challenge row is the
  source of truth, the push is best-effort.
"""
from __future__ import annotations

import json
import logging
import urllib.request
import urllib.error
from typing import Optional

from ..core.config import settings

logger = logging.getLogger(__name__)


def send_expo_push(
    token: str,
    title: str,
    body: str,
    data: Optional[dict] = None,
    timeout: int = 10,
) -> bool:
    """
    Send an Expo push. Returns True if Expo accepted it (HTTP 200 with no
    per-message error), False otherwise. Never raises.

    `token` must be an Expo push token like "ExponentPushToken[xxxx...]".
    """
    if not token or not token.startswith("ExponentPushToken["):
        logger.warning(f"⚠️ Skipping push: invalid Expo token '{token[:30]}...'")
        return False

    payload = {
        "to": token,
        "title": title,
        "body": body,
        "sound": "default",
        "priority": "high",
        "data": data or {},
    }

    try:
        req = urllib.request.Request(
            settings.EXPO_PUSH_URL,
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "Accept": "application/json",
                "Accept-Encoding": "gzip, deflate",
            },
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=timeout) as r:
            raw = r.read().decode()
            if r.status != 200:
                logger.warning(f"⚠️ Expo push returned HTTP {r.status}: {raw[:200]}")
                return False

            # Expo returns {"data":{"status":"ok","id":"..."}} on success,
            # or {"data":{"status":"error","message":"...","details":{...}}}
            try:
                resp = json.loads(raw)
                if isinstance(resp.get("data"), list):
                    # bulk send shape (unlikely for single)
                    status = resp["data"][0].get("status") if resp["data"] else "error"
                else:
                    status = resp.get("data", {}).get("status", "ok")
                if status != "ok":
                    logger.warning(f"⚠️ Expo push rejected: {raw[:200]}")
                    return False
                logger.info(f"✅ Expo push accepted for token ...{token[-8:]}")
                return True
            except Exception as e:
                logger.warning(f"⚠️ Could not parse Expo response: {e} | raw={raw[:200]}")
                return False

    except urllib.error.HTTPError as e:
        logger.warning(f"⚠️ Expo push HTTPError {e.code}: {e.read()[:200] if e.fp else ''}")
        return False
    except Exception as e:
        logger.warning(f"⚠️ Expo push failed: {e}")
        return False