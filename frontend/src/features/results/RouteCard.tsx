import { useSimulationState } from "../../context/useSimulationState";
import type { RouteResult, ZoneResult } from "../../types/api";

interface RouteCardProps {
  zone: ZoneResult;
}

export function RouteCard({ zone }: RouteCardProps) {
  return (
    <article className="route-card">
      <div className="route-card__header">
        <strong>{zone.zone_id}</strong>
        <span>{zone.population.toLocaleString()} people</span>
      </div>
      <RouteLine label="Baseline" route={zone.baseline_route} />
      {zone.optimized_route ? <RouteLine label="Optimized" route={zone.optimized_route} /> : null}
    </article>
  );
}

function RouteLine({ label, route }: { label: string; route: RouteResult }) {
  const { dispatch } = useSimulationState();

  return (
    <div className="route-line">
      <div>
        <span>{label}</span>
        <strong>{(route.viability_score ?? 0).toFixed(0)}%</strong>
      </div>
      <div>
        <span>Travel</span>
        <strong>{route.total_travel_time_min.toFixed(0)}m</strong>
      </div>
      <button
        className="secondary-button"
        type="button"
        onClick={() =>
          dispatch({ type: "routeSelected", routeId: route.route_id, zoneId: route.zone_id })
        }
      >
        Show on Map
      </button>
    </div>
  );
}
