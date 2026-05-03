"""Shared Overpass API rate limiter (thread-safe)."""
from __future__ import annotations

import threading
import time
import requests

OVERPASS_URL = "https://overpass-api.de/api/interpreter"
_lock = threading.Lock()
_last_request_time = 0.0
_MIN_INTERVAL = 1.0


def overpass_query(query: str, timeout: int = 60) -> dict:
    global _last_request_time
    with _lock:
        elapsed = time.time() - _last_request_time
        if elapsed < _MIN_INTERVAL:
            time.sleep(_MIN_INTERVAL - elapsed)
        _last_request_time = time.time()

    r = requests.post(
        OVERPASS_URL,
        data={"data": query},
        timeout=timeout,
        headers={"User-Agent": "EvacuAI/1.0"},
    )
    r.raise_for_status()
    return r.json()
