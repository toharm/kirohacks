"""NWS (National Weather Service) API client for live wind data.

Fetches current wind conditions from api.weather.gov for any lat/lon.
NWS coverage is US-only; non-US coordinates will trigger fallback values.
Supports manual override to skip API calls entirely.
"""

import logging
import re
from dataclasses import dataclass

import requests

from backend.models.schemas import WindConditions

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

NWS_BASE_URL = "https://api.weather.gov"
NWS_TIMEOUT_SECONDS = 10
NWS_HEADERS = {"User-Agent": "EvacuAI/1.0"}

COMPASS_TO_DEGREES: dict[str, float] = {
    "N": 0.0,
    "NE": 45.0,
    "E": 90.0,
    "SE": 135.0,
    "S": 180.0,
    "SW": 225.0,
    "W": 270.0,
    "NW": 315.0,
}

# Regex to extract a numeric value from strings like "14 mph" or "5.5 mph"
_WIND_SPEED_RE = re.compile(r"([\d.]+)\s*mph", re.IGNORECASE)


# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------


def parse_wind_speed(s: str) -> float:
    """Parse a wind speed string like ``"14 mph"`` into a float value.

    Args:
        s: Wind speed string in the format ``"<number> mph"``.

    Returns:
        The numeric wind speed as a float.

    Raises:
        ValueError: If the string cannot be parsed.
    """
    match = _WIND_SPEED_RE.search(s)
    if match is None:
        raise ValueError(f"Cannot parse wind speed from string: {s!r}")
    return float(match.group(1))


def compass_to_degrees(direction: str) -> float:
    """Convert a compass direction string to degrees.

    Supported directions: N, NE, E, SE, S, SW, W, NW.

    Args:
        direction: Compass direction string (case-insensitive).

    Returns:
        Direction in degrees (0.0 for N, 45.0 for NE, etc.).

    Raises:
        ValueError: If the direction is not a recognized compass point.
    """
    key = direction.strip().upper()
    if key not in COMPASS_TO_DEGREES:
        raise ValueError(
            f"Unknown compass direction: {direction!r}. "
            f"Expected one of {list(COMPASS_TO_DEGREES.keys())}"
        )
    return COMPASS_TO_DEGREES[key]


@dataclass
class WindFetchResult:
    """Result of a wind fetch, including the data source."""

    conditions: WindConditions
    source: str  # "nws_live", "fallback", or "manual_override"


# ---------------------------------------------------------------------------
# NWS Wind Client
# ---------------------------------------------------------------------------


class NWSWindClient:
    """Fetches live wind data from the National Weather Service API.

    Usage::

        client = NWSWindClient()
        wind = client.fetch(lat=39.76, lon=-121.62)

    If the NWS API is unreachable, returns US-only data, or times out,
    the client returns ``FALLBACK_WIND`` and logs a warning.

    If an ``override`` is provided, the API call is skipped entirely.
    """

    FALLBACK_WIND = WindConditions(
        wind_speed_mph=10.0,
        wind_direction_deg=225.0,  # SW
        wind_gust_mph=20.0,
        relative_humidity=20.0,
    )

    def fetch(
        self,
        lat: float,
        lon: float,
        override: WindConditions | None = None,
    ) -> WindFetchResult:
        """Fetch current wind conditions for a location.

        Args:
            lat: Latitude of the location.
            lon: Longitude of the location.
            override: If provided, returned directly without any API call.

        Returns:
            A ``WindFetchResult`` with conditions and source indicator.
        """
        if override is not None:
            return WindFetchResult(conditions=override, source="manual_override")

        try:
            grid_id, grid_x, grid_y = self._resolve_grid(lat, lon)
            conditions = self._fetch_forecast(grid_id, grid_x, grid_y)
            return WindFetchResult(conditions=conditions, source="nws_live")
        except Exception as exc:
            logger.warning(
                "NWS wind fetch failed for (%.4f, %.4f): %s. "
                "Returning fallback wind conditions.",
                lat,
                lon,
                exc,
            )
            return WindFetchResult(conditions=self.FALLBACK_WIND, source="fallback")

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _resolve_grid(
        self, lat: float, lon: float
    ) -> tuple[str, int, int]:
        """Resolve lat/lon to NWS grid coordinates.

        Calls ``GET /points/{lat},{lon}`` and extracts
        ``gridId``, ``gridX``, ``gridY``.

        Raises on HTTP errors or unexpected response structure.
        """
        url = f"{NWS_BASE_URL}/points/{lat},{lon}"
        resp = requests.get(
            url, headers=NWS_HEADERS, timeout=NWS_TIMEOUT_SECONDS
        )
        resp.raise_for_status()

        props = resp.json()["properties"]
        grid_id: str = props["gridId"]
        grid_x: int = int(props["gridX"])
        grid_y: int = int(props["gridY"])
        return grid_id, grid_x, grid_y

    def _fetch_forecast(
        self, grid_id: str, grid_x: int, grid_y: int
    ) -> WindConditions:
        """Fetch the hourly forecast and parse the first period.

        Calls ``GET /gridpoints/{gridId}/{gridX},{gridY}/forecast/hourly``
        and extracts wind speed, direction, gust, and humidity from the
        first forecast period.

        Raises on HTTP errors or unexpected response structure.
        """
        url = (
            f"{NWS_BASE_URL}/gridpoints/{grid_id}/"
            f"{grid_x},{grid_y}/forecast/hourly"
        )
        resp = requests.get(
            url, headers=NWS_HEADERS, timeout=NWS_TIMEOUT_SECONDS
        )
        resp.raise_for_status()

        period = resp.json()["properties"]["periods"][0]

        wind_speed_mph = parse_wind_speed(period["windSpeed"])
        wind_direction_deg = compass_to_degrees(period["windDirection"])

        # Gust may be None in the NWS response
        wind_gust_str = period.get("windGust")
        if wind_gust_str:
            wind_gust_mph = parse_wind_speed(wind_gust_str)
        else:
            # Default gust to 1.5× wind speed when not reported
            wind_gust_mph = wind_speed_mph * 1.5

        # Humidity may be reported as an integer or nested object
        humidity_raw = period.get("relativeHumidity")
        if isinstance(humidity_raw, dict):
            relative_humidity = float(humidity_raw.get("value", 20.0))
        elif humidity_raw is not None:
            relative_humidity = float(humidity_raw)
        else:
            relative_humidity = 20.0

        return WindConditions(
            wind_speed_mph=wind_speed_mph,
            wind_direction_deg=wind_direction_deg,
            wind_gust_mph=wind_gust_mph,
            relative_humidity=relative_humidity,
        )
