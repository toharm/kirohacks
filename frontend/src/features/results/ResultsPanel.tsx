import { MetricCard } from "../../components/MetricCard";
import { useSimulationState } from "../../context/useSimulationState";
import { useSimulation } from "../../hooks/useSimulation";
import type { SimulationResponse } from "../../types/api";
import { ComparisonView } from "./ComparisonView";
import { EvacuationOrdering } from "./EvacuationOrdering";
import { RouteCard } from "./RouteCard";
import { ZoneEvacuationTable } from "./ZoneEvacuationTable";

export function ResultsPanel() {
  const { state, dispatch } = useSimulationState();
  const { runSimulation } = useSimulation();
  const result = state.result;

  return (
    <aside className={`panel results-panel ${state.panels.results ? "is-open" : ""}`}>
      <div className="panel__header">
        <div>
          <span className="eyebrow">Results Panel</span>
          <h2>Route Intelligence</h2>
        </div>
        <button
          className="icon-button panel__close"
          type="button"
          aria-label="Close results"
          onClick={() => dispatch({ type: "panelSet", panel: "results", open: false })}
        >
          x
        </button>
      </div>

      {!result ? (
        <div className="empty-results">
          <MetricCard
            label="Awaiting Simulation"
            value="Ready"
            tone="info"
            detail="Configure ignition, wind, and runs to populate route comparison."
          />
        </div>
      ) : (
        <>
          <MetricCard
            label="Key Demo Metric"
            value={keyRouteMetric(result)}
            tone="info"
            detail={`Route ${bestRouteName(result)} survives across sampled scenarios`}
            large
          />

          <ComparisonView result={result} previousResult={state.previousResult} />

          <section className="summary-grid" aria-label="Summary statistics">
            <MetricCard
              label="Population At Risk"
              value={totalPopulation(result).toLocaleString()}
              tone="warning"
            />
            <MetricCard
              label="Cutoff Below 10m"
              value={zonesUnderCutoff(result, 10)}
              unit="zones"
              tone="critical"
            />
            <MetricCard
              label="Optimization Lift"
              value={optimizationLift(result).toFixed(1)}
              unit="%"
              tone="success"
            />
            <MetricCard
              label="MC Confidence"
              value="90"
              unit="% CI"
              tone="default"
            />
          </section>

          <div className="results-actions">
            <button
              className="secondary-button"
              type="button"
              disabled={state.status === "running"}
              onClick={() => void runSimulation({ quickCompare: true })}
            >
              Quick Compare +45 deg
            </button>
          </div>

          <ZoneEvacuationTable zones={result.zone_results} />

          <section className="results-section">
            <div className="section-title">
              <h3>Per-Zone Routes</h3>
              <span>best paths</span>
            </div>
            <div className="route-card-list">
              {result.zone_results.map((zone) => (
                <RouteCard key={zone.zone_id} zone={zone} />
              ))}
            </div>
          </section>

          <EvacuationOrdering zones={result.zone_results} ordering={result.evacuation_ordering} />
        </>
      )}
    </aside>
  );
}

function bestRouteName(result: SimulationResponse) {
  return bestOptimizedRoute(result)?.route_id ?? "optimized";
}

function keyRouteMetric(result: SimulationResponse) {
  const route = bestOptimizedRoute(result);
  return `${(route?.viability_score ?? 0).toFixed(0)}%`;
}

function bestOptimizedRoute(result: SimulationResponse) {
  return result.zone_results
    .map((zone) => zone.optimized_route)
    .filter((route) => route !== null && route !== undefined)
    .sort((a, b) => (b.viability_score ?? 0) - (a.viability_score ?? 0))[0];
}

function totalPopulation(result: SimulationResponse) {
  return result.zone_results.reduce((sum, zone) => sum + zone.population, 0);
}

function zonesUnderCutoff(result: SimulationResponse, cutoff: number) {
  return result.zone_results.filter((zone) => (zone.cutoff_time ?? Infinity) < cutoff).length;
}

function optimizationLift(result: SimulationResponse) {
  const baseline = average(result.zone_results.map((zone) => zone.baseline_route.viability_score ?? 0));
  const optimized = average(result.zone_results.map((zone) => zone.optimized_route?.viability_score ?? 0));
  return optimized - baseline;
}

function average(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
}
