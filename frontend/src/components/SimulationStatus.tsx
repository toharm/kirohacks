import type { RunStatus } from "../context/simulationReducer";

interface SimulationStatusProps {
  status: RunStatus;
  modifiedWind: boolean;
}

export function SimulationStatus({ status, modifiedWind }: SimulationStatusProps) {
  const label = status === "running" ? "Running" : status === "complete" ? "Complete" : status === "error" ? "Attention" : "Ready";

  return (
    <div className={`simulation-status simulation-status--${status}`}>
      <span className="simulation-status__dot" aria-hidden="true" />
      <span>{label}</span>
      {modifiedWind ? <span className="badge badge--warning">Modified Wind</span> : null}
    </div>
  );
}
