from __future__ import annotations

import logging
import re
from typing import Optional

import requests

from backend.models.schemas import WindConditions

logger = logging.getLogger(__name__)

COMPASS_TO_DEG = {
    "N": 0.0, "NNE": 22.5, "NE": 45.0, "ENE": 67.5,
    "E": 90.0, "ESE": 112.5, "SE": 135.0, "SSE": 157.5,
    "S": 180.0, "SSW": 202.5, "SW": 225.0, "WSW": 247.5,
    "W": 270.0, "WNW": 292.5, "NW": 315.0, "NNW": 337.5,
}


def _parse_speed(s: str) -> Optional[float]:
    """Parse '14 mph' → 14.0"""
    if s is None:
        return None
    m = re.search(r"[\d.]+", str(s))
    return float(m.group()) if m else None


def _parse_direction(s: str) -> Optional[float]:
    """Parse compass string or numeric string to degrees."""
    if s is None:
        return None
    s = str(s).strip().upper()
    if s in COMPASS_TO_DEG:
        return COMPASS_TO_DEG[s]
    try:
        return float(s)
    except ValueError:
        return None


class NWSWindClient:
    FALLBACK_WIND = WindConditions(
        wind_speed_mph=10.0,
        wind_direction_deg=225.0,
        wind_gust_mph=20.0,
        relative_humidity=20.0,
    )
    HEADERS = {"User-Agent": "EvacuAI/1.0"}
    TIMEOUT = 10

    def fetch(
        self,
        lat: float,
        lon: float,
        override: Optional[WindConditions] = None,
    ) -> WindConditions:
        if override is not None:
            return override

        try:
            points_url = f"https://api.weather.gov/points/{lat},{lon}"
            r = requests.get(points_url, headers=self.HEADERS, timeout=self.TIMEOUT)
            if r.status_code != 200:
                logger.warning("NWS points API returned %s for (%s, %s)", r.status_code, lat, lon)
                return self.FALLBACK_WIND

            props = r.json().get("properties", {})
            grid_id = props.get("gridId")
            grid_x = props.get("gridX")
            grid_y = props.get("gridY")
            if not all([grid_id, grid_x, grid_y]):
                logger.warning("NWS points response missing grid fields")
                return self.FALLBACK_WIND

            forecast_url = (
                f"https://api.weather.gov/gridpoints/{grid_id}/{grid_x},{grid_y}/forecast/hourly"
            )
            r2 = requests.get(forecast_url, headers=self.HEADERS, timeout=self.TIMEOUT)
            if r2.status_code != 200:
                logger.warning("NWS forecast API returned %s", r2.status_code)
                return self.FALLBACK_WIND

            periods = r2.json().get("properties", {}).get("periods", [])
            if not periods:
                logger.warning("NWS forecast has no periods")
                return self.FALLBACK_WIND

            period = periods[0]
            wind_speed = _parse_speed(period.get("windSpeed"))
            wind_dir = _parse_direction(period.get("windDirection"))
            wind_gust = _parse_speed(period.get("windGust")) or (wind_speed * 1.5 if wind_speed else 20.0)
            humidity = period.get("relativeHumidity", {})
            if isinstance(humidity, dict):
                humidity = humidity.get("value")
            humidity = float(humidity) if humidity is not None else 20.0

            if wind_speed is None or wind_dir is None:
                logger.warning("NWS response missing wind fields")
                return self.FALLBACK_WIND

            return WindConditions(
                wind_speed_mph=wind_speed,
                wind_direction_deg=wind_dir,
                wind_gust_mph=wind_gust,
                relative_humidity=humidity,
            )

        except Exception as e:
            logger.warning("NWS fetch failed: %s", e)
            return self.FALLBACK_WIND
