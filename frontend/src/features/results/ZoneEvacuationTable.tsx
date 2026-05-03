import { useState } from "react";
import { useSimulationState } from "../../context/useSimulationState";
import type { ZoneResult } from "../../types/api";

type SortKey =
  | "zone_id"
  | "population"
  | "cutoff_time"
  | "evacuation_priority_score"
  | "failure_risk_pct";

interface ZoneEvacuationTableProps {
  zones: ZoneResult[];
}

export function ZoneEvacuationTable({ zones }: ZoneEvacuationTableProps) {
  const { state, dispatch } = useSimulationState();
  const [sortKey, setSortKey] = useState<SortKey>("evacuation_priority_score");
  const sortedZones = zones.slice().sort((a, b) => compareZones(a, b, sortKey));

  return (
    <section className="results-section">
      <div className="section-title">
        <h3>Zone Evacuation Table</h3>
        <span>{zones.length} zones</span>
      </div>
      <div className="table-scroll">
        <table className="zone-table">
          <thead>
            <tr>
              <Header label="Zone ID" sortKey="zone_id" active={sortKey} setSortKey={setSortKey} />
              <Header label="Pop" sortKey="population" active={sortKey} setSortKey={setSortKey} />
              <Header label="Cutoff" sortKey="cutoff_time" active={sortKey} setSortKey={setSortKey} />
              <Header
                label="Priority"
                sortKey="evacuation_priority_score"
                active={sortKey}
                setSortKey={setSortKey}
              />
              <th>Base</th>
              <th>Opt</th>
              <Header label="Risk" sortKey="failure_risk_pct" active={sortKey} setSortKey={setSortKey} />
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {sortedZones.map((zone) => (
              <tr
                className={state.selectedZoneId === zone.zone_id ? "is-selected" : ""}
                key={zone.zone_id}
                onClick={() => dispatch({ type: "zoneSelected", zoneId: zone.zone_id })}
              >
                <td>{zone.zone_id}</td>
                <td>{zone.population.toLocaleString()}</td>
                <td>{zone.cutoff_time ?? "n/a"}m</td>
                <td>{zone.evacuation_priority_score.toFixed(0)}</td>
                <td>{(zone.baseline_route.viability_score ?? 0).toFixed(0)}%</td>
                <td>{(zone.optimized_route?.viability_score ?? 0).toFixed(0)}%</td>
                <td>{(zone.failure_risk_pct ?? 0).toFixed(0)}%</td>
                <td>
                  <span className={`status-pill status-pill--${statusFor(zone.cutoff_time)}`}>
                    {statusFor(zone.cutoff_time)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Header({
  label,
  sortKey,
  active,
  setSortKey,
}: {
  label: string;
  sortKey: SortKey;
  active: SortKey;
  setSortKey: (sortKey: SortKey) => void;
}) {
  return (
    <th>
      <button
        className={active === sortKey ? "table-sort is-active" : "table-sort"}
        type="button"
        onClick={() => setSortKey(sortKey)}
      >
        {label}
      </button>
    </th>
  );
}

function compareZones(a: ZoneResult, b: ZoneResult, key: SortKey) {
  if (key === "zone_id") {
    return a.zone_id.localeCompare(b.zone_id);
  }
  return Number(b[key] ?? 0) - Number(a[key] ?? 0);
}

function statusFor(cutoff?: number | null) {
  if (cutoff === null || cutoff === undefined) {
    return "warning";
  }
  if (cutoff < 5) {
    return "critical";
  }
  if (cutoff < 15) {
    return "warning";
  }
  return "safe";
}
