import time
import threading
import requests


class IngestError(Exception):
    pass


class OverpassClient:
    _URL = "https://overpass-api.de/api/interpreter"

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._last_ts: float = 0.0
        self._last_duration: float = 0.0

    def query(self, overpass_ql: str, timeout: int = 60) -> dict:
        with self._lock:
            elapsed = time.monotonic() - self._last_ts
            wait = max(0.0, self._last_duration - elapsed)
            if wait:
                time.sleep(wait)

            for attempt in range(3):
                t0 = time.monotonic()
                try:
                    resp = requests.post(
                        self._URL,
                        data={"data": overpass_ql},
                        headers={"User-Agent": "EvacuAI/1.0"},
                        timeout=timeout,
                    )
                except requests.RequestException as e:
                    raise IngestError(f"Overpass request failed: {e}") from e

                self._last_duration = time.monotonic() - t0
                self._last_ts = t0

                if resp.status_code == 429:
                    time.sleep(2 ** attempt)
                    continue

                if not resp.ok:
                    raise IngestError(
                        f"Overpass returned HTTP {resp.status_code}: {resp.text[:200]}"
                    )

                return resp.json()

            raise IngestError("Overpass rate-limited after 3 retries")
