interface MetricCardProps {
  label: string;
  value: string | number;
  unit?: string;
  tone?: "default" | "success" | "warning" | "critical" | "info";
  detail?: string;
  large?: boolean;
}

export function MetricCard({
  label,
  value,
  unit,
  tone = "default",
  detail,
  large = false,
}: MetricCardProps) {
  return (
    <article className={`metric-card metric-card--${tone} ${large ? "metric-card--large" : ""}`}>
      <span className="metric-card__label">{label}</span>
      <div className="metric-card__value-row">
        <strong className="metric-card__value">{value}</strong>
        {unit ? <span className="metric-card__unit">{unit}</span> : null}
      </div>
      {detail ? <span className="metric-card__detail">{detail}</span> : null}
    </article>
  );
}
