import { MetricCard } from "../../components/MetricCard";
import type { SimulationResponse } from "../../types/api";

interface ComparisonViewProps {
  result: SimulationResponse;
  previousResult: SimulationResponse | null;
}

export function ComparisonView({ result, previousResult }: ComparisonViewProps) {
  const current = aggregate(result);
  const previous = previousResult ? aggregate(previousResult) : null;

  return (
    <section className="comparison-view">
      <div className="comparison-view__columns">
        <StrategyColumn
          label="Baseline (Shortest Path)"
          score={current.baselineScore}
          time={current.baselineTime}
          risk={current.failureRisk}
        />
        <StrategyColumn
          label="Optimized (Multi-Factor)"
          score={current.optimizedScore}
          time={current.optimizedTime}
          risk={Math.max(0, current.failureRisk - current.improvement)}
          emphasized
        />
      </div>
      {previous ? (
        <div className="comparison-view__previous">
          <MetricCard
            label="Quick Compare Delta"
            value={`${(current.optimizedScore - previous.optimizedScore).toFixed(1)}`}
            unit="pts"
            tone={current.optimizedScore >= previous.optimizedScore ? "success" : "warning"}
            detail="optimized route viability shift"
          />
        </div>
      ) : null}
    </section>
  );
}

function StrategyColumn({
  label,
  score,
  time,
  risk,
  emphasized = false,
}: {
  label: string;
  score: number;
  time: number;
  risk: number;
  emphasized?: boolean;
}) {
  return (
    <article className={`strategy-column ${emphasized ? "is-emphasized" : ""}`}>
      <h3>{label}</h3>
      <dl>
        <div>
          <dt>Viability</dt>
          <dd>{score.toFixed(1)}%</dd>
        </div>
        <div>
          <dt>Avg evac time</dt>
          <dd>{time.toFixed(0)} min</dd>
        </div>
        <div>
          <dt>Failure risk</dt>
          <dd>{risk.toFixed(1)}%</dd>
        </div>
      </dl>
    </article>
  );
}

function aggregate(result: SimulationResponse) {
  const zones = result.zone_results;
  const baselineScore = average(zones.map((zone) => zone.baseline_route.viability_score ?? 0));
  const optimizedScore = average(zones.map((zone) => zone.optimized_route?.viability_score ?? 0));
  const baselineTime = average(zones.map((zone) => zone.baseline_route.total_travel_time_min));
  const optimizedTime = average(zones.map((zone) => zone.optimized_route?.total_travel_time_min ?? 0));
  const failureRisk = average(zones.map((zone) => zone.failure_risk_pct ?? 0));

  return {
    baselineScore,
    optimizedScore,
    baselineTime,
    optimizedTime,
    failureRisk,
    improvement: Math.max(0, optimizedScore - baselineScore),
  };
}

function average(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
}
