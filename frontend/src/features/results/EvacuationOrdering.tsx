import { useSimulationState } from "../../context/useSimulationState";
import type { ZoneResult } from "../../types/api";

interface EvacuationOrderingProps {
  zones: ZoneResult[];
  ordering: string[];
}

export function EvacuationOrdering({ zones, ordering }: EvacuationOrderingProps) {
  const { dispatch } = useSimulationState();
  const zoneLookup = new Map(zones.map((zone) => [zone.zone_id, zone]));

  return (
    <section className="results-section">
      <div className="section-title">
        <h3>Evacuation Ordering</h3>
        <span>priority first</span>
      </div>
      <ol className="ordering-list">
        {ordering.map((zoneId) => {
          const zone = zoneLookup.get(zoneId);
          if (!zone) {
            return null;
          }

          return (
            <li key={zone.zone_id}>
              <button type="button" onClick={() => dispatch({ type: "zoneSelected", zoneId })}>
                <span className={`urgency-dot urgency-dot--${urgency(zone.cutoff_time)}`} />
                <strong>{zone.zone_id}</strong>
                <span>{zone.evacuation_priority_score.toFixed(0)} priority</span>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function urgency(cutoff?: number | null) {
  if (cutoff === null || cutoff === undefined || cutoff < 5) {
    return "critical";
  }
  if (cutoff < 15) {
    return "warning";
  }
  if (cutoff < 30) {
    return "notice";
  }
  return "safe";
}
