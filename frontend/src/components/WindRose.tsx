import type { WindConditions } from "../types/api";

interface WindRoseProps {
  wind: WindConditions;
  compact?: boolean;
}

export function WindRose({ wind, compact = false }: WindRoseProps) {
  return (
    <div className={`wind-rose ${compact ? "wind-rose--compact" : ""}`} aria-label="Wind conditions">
      <div className="wind-rose__compass" aria-hidden="true">
        <span>N</span>
        <div
          className="wind-rose__arrow"
          style={{ transform: `rotate(${wind.wind_direction_deg}deg)` }}
        />
      </div>
      <div className="wind-rose__readout">
        <strong>{Math.round(wind.wind_speed_mph)} mph</strong>
        <span>gust {Math.round(wind.wind_gust_mph)} mph</span>
        <span>{Math.round(wind.relative_humidity)}% RH</span>
      </div>
    </div>
  );
}
