import { useSimulationState } from "../../context/useSimulationState";
import { useSimulation } from "../../hooks/useSimulation";
import type { WindConditions } from "../../types/api";

const windFields: Array<{
  field: keyof WindConditions;
  label: string;
  min: number;
  max: number;
  unit: string;
}> = [
  { field: "wind_speed_mph", label: "Wind speed", min: 0, max: 100, unit: "mph" },
  { field: "wind_direction_deg", label: "Direction", min: 0, max: 359, unit: "deg" },
  { field: "wind_gust_mph", label: "Gust", min: 0, max: 150, unit: "mph" },
  { field: "relative_humidity", label: "Humidity", min: 0, max: 100, unit: "%" },
];

export function ControlPanel() {
  const { state, dispatch } = useSimulationState();
  const { fetchLiveWind, runSimulation } = useSimulation();
  const running = state.status === "running";
  const manualWind = state.windMode === "manual";

  return (
    <aside className={`panel control-panel ${state.panels.controls ? "is-open" : ""}`}>
      <div className="panel__header">
        <div>
          <span className="eyebrow">Control Panel</span>
          <h2>Simulation Setup</h2>
        </div>
        <button
          className="icon-button panel__close"
          type="button"
          aria-label="Close controls"
          onClick={() => dispatch({ type: "panelSet", panel: "controls", open: false })}
        >
          x
        </button>
      </div>

      {state.demoMode ? (
        <section className="demo-steps" aria-label="Demo flow">
          {["Select Ignition", "Fetch Wind", "Run Simulation", "Compare Routes", "Adjust and Re-run"].map(
            (step, index) => (
              <span className={index < demoStepIndex(state.status) ? "is-complete" : ""} key={step}>
                {index + 1}. {step}
              </span>
            ),
          )}
        </section>
      ) : null}

      <section className="control-section">
        <div className="section-title">
          <h3>Scenario</h3>
          <span>{state.scenarios.length} presets</span>
        </div>
        <label className="field">
          <span>Preset</span>
          <select
            value={state.selectedScenarioName}
            onChange={(event) => {
              const scenario = state.scenarios.find((item) => item.name === event.target.value);
              if (scenario) {
                dispatch({ type: "scenarioSelected", scenario });
              }
            }}
          >
            <option>Custom scenario</option>
            {state.scenarios.map((scenario) => (
              <option key={scenario.name} value={scenario.name}>
                {scenario.name}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="control-section">
        <div className="section-title">
          <h3>Ignition</h3>
          <button
            className={`secondary-button ${state.selectIgnitionMode ? "is-active" : ""}`}
            type="button"
            onClick={() =>
              dispatch({ type: "selectIgnitionModeSet", enabled: !state.selectIgnitionMode })
            }
          >
            Select on Map
          </button>
        </div>
        <div className="coord-grid">
          <Readout label="Lat" value={state.ignition.lat.toFixed(5)} />
          <Readout label="Lon" value={state.ignition.lon.toFixed(5)} />
        </div>
        {state.fieldErrors.ignition_lat || state.fieldErrors.ignition_lon ? (
          <p className="field-error">
            {state.fieldErrors.ignition_lat ?? state.fieldErrors.ignition_lon}
          </p>
        ) : null}
      </section>

      <section className="control-section">
        <div className="section-title">
          <h3>Wind</h3>
          <div className="segmented-control" role="group" aria-label="Wind mode">
            <button
              className={state.windMode === "live" ? "is-selected" : ""}
              type="button"
              onClick={fetchLiveWind}
            >
              Live
            </button>
            <button
              className={manualWind ? "is-selected" : ""}
              type="button"
              onClick={() => dispatch({ type: "windModeSet", mode: "manual" })}
            >
              Manual
            </button>
          </div>
        </div>
        <button className="secondary-button secondary-button--full" type="button" onClick={fetchLiveWind}>
          Fetch Live Wind
        </button>
        <div className="field-grid">
          {windFields.map((item) => (
            <label className="field" key={item.field}>
              <span>{item.label}</span>
              <div className="input-with-unit">
                <input
                  disabled={!manualWind}
                  max={item.max}
                  min={item.min}
                  step={item.field === "wind_direction_deg" ? 1 : 0.5}
                  type="number"
                  value={state.wind[item.field]}
                  onChange={(event) =>
                    dispatch({
                      type: "windFieldSet",
                      field: item.field,
                      value: Number(event.target.value),
                    })
                  }
                />
                <span>{item.unit}</span>
              </div>
              {state.fieldErrors[item.field] ? (
                <span className="field-error">{state.fieldErrors[item.field]}</span>
              ) : null}
            </label>
          ))}
        </div>
      </section>

      <section className="control-section">
        <div className="section-title">
          <h3>Uncertainty</h3>
          <output>{state.numRuns} runs</output>
        </div>
        <input
          aria-label="Monte Carlo runs"
          max={1000}
          min={50}
          step={50}
          type="range"
          value={state.numRuns}
          onChange={(event) => dispatch({ type: "numRunsSet", value: Number(event.target.value) })}
        />
        {state.fieldErrors.num_runs ? <p className="field-error">{state.fieldErrors.num_runs}</p> : null}
      </section>

      <section className="control-section">
        <div className="section-title">
          <h3>Map Layers</h3>
          <span>WebGL overlays</span>
        </div>
        <div className="layer-list">
          {Object.entries(state.layers).map(([layer, enabled]) => (
            <label className="toggle-row" key={layer}>
              <span>{layerLabel(layer)}</span>
              <input
                checked={enabled}
                type="checkbox"
                onChange={(event) =>
                  dispatch({
                    type: "layerSet",
                    layer: layer as keyof typeof state.layers,
                    value: event.target.checked,
                  })
                }
              />
            </label>
          ))}
        </div>
        <label className="field">
          <span>Burn opacity</span>
          <input
            max={0.9}
            min={0.2}
            step={0.05}
            type="range"
            value={state.burnOpacity}
            onChange={(event) =>
              dispatch({ type: "burnOpacitySet", value: Number(event.target.value) })
            }
          />
        </label>
        <label className="field">
          <span>Terrain exaggeration</span>
          <input
            max={3}
            min={1}
            step={0.1}
            type="range"
            value={state.terrainExaggeration}
            onChange={(event) =>
              dispatch({ type: "terrainExaggerationSet", value: Number(event.target.value) })
            }
          />
        </label>
      </section>

      {state.progress ? (
        <section className="progress-card">
          <div className="progress-card__top">
            <strong>{state.progress.phase}</strong>
            <span>
              {state.progress.completedRuns} / {state.progress.totalRuns}
            </span>
          </div>
          <progress value={state.progress.completedRuns} max={state.progress.totalRuns} />
          <span>
            elapsed {state.progress.elapsedSec.toFixed(1)}s, eta {state.progress.etaSec.toFixed(1)}s
          </span>
          <div className="fire-preview" aria-hidden="true" />
        </section>
      ) : null}

      {state.apiError ? <p className="api-error">{state.apiError}</p> : null}

      <button
        className="run-button"
        type="button"
        disabled={running}
        onClick={() => void runSimulation()}
      >
        {running ? "Running Simulation" : "Run Simulation"}
      </button>
    </aside>
  );
}

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <div className="coordinate-readout">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function layerLabel(layer: string) {
  return layer
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (char) => char.toUpperCase());
}

function demoStepIndex(status: string) {
  if (status === "complete") {
    return 4;
  }
  if (status === "running") {
    return 3;
  }
  return 1;
}
