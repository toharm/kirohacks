import { useSimulationStore } from "../../stores/simulationStore";
import type { SimulationStore } from "../../stores/simulationStore";
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
  const store = useSimulationStore() as SimulationStore;
  const { fetchLiveWind, runSimulation, cancelSimulation } = useSimulation();
  const running = store.status === "running";
  const manualWind = store.windMode === "manual";

  return (
    <aside className={`panel control-panel ${store.panels.controls ? "is-open" : ""}`}>
      <div className="panel__header">
        <div>
          <span className="eyebrow">Control Panel</span>
          <h2>Simulation Setup</h2>
        </div>
        <button
          className="icon-button panel__close"
          type="button"
          aria-label="Close controls"
          onClick={() => store.setPanel("controls", false)}
        >
          ✕
        </button>
      </div>

      {store.demoMode ? (
        <section className="demo-steps" aria-label="Demo flow">
          {(["Select Ignition", "Fetch Wind", "Run Simulation", "Compare Routes", "Adjust and Re-run"] as const).map(
            (step, index) => (
              <span
                className={index < demoStepIndex(store) ? "is-complete" : ""}
                key={step}
              >
                {index + 1}. {step}
              </span>
            ),
          )}
        </section>
      ) : null}

      <section className="control-section">
        <div className="section-title">
          <h3>Scenario</h3>
          <span>{store.scenarios.length} presets</span>
        </div>
        <label className="field">
          <span>Preset</span>
          <select
            value={store.selectedScenarioName}
            onChange={(event) => {
              const scenario = store.scenarios.find((item) => item.name === event.target.value);
              if (scenario) store.selectScenario(scenario);
            }}
          >
            <option>Custom scenario</option>
            {store.scenarios.map((scenario) => (
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
            className={`secondary-button ${store.selectIgnitionMode ? "is-active" : ""}`}
            type="button"
            onClick={() => store.setSelectIgnitionMode(!store.selectIgnitionMode)}
          >
            Select on Map
          </button>
        </div>
        {store.selectIgnitionMode ? (
          <p className="ignite-banner" role="status">
            Click the map to place ignition point — <kbd>Esc</kbd> to cancel
          </p>
        ) : null}
        <div className="coord-grid">
          <Readout label="Lat" value={store.ignition.lat.toFixed(5)} />
          <Readout label="Lon" value={store.ignition.lon.toFixed(5)} />
        </div>
        {store.fieldErrors.ignition_lat || store.fieldErrors.ignition_lon ? (
          <p className="field-error">
            {store.fieldErrors.ignition_lat ?? store.fieldErrors.ignition_lon}
          </p>
        ) : null}
      </section>

      <section className="control-section">
        <div className="section-title">
          <h3>Wind</h3>
          <div className="segmented-control" role="group" aria-label="Wind mode">
            <button
              className={store.windMode === "live" ? "is-selected" : ""}
              type="button"
              onClick={fetchLiveWind}
            >
              Live
            </button>
            <button
              className={manualWind ? "is-selected" : ""}
              type="button"
              onClick={() => store.setWindMode("manual")}
            >
              Manual
            </button>
          </div>
        </div>
        <button
          className="secondary-button secondary-button--full"
          type="button"
          onClick={fetchLiveWind}
        >
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
                  value={store.wind[item.field]}
                  onChange={(event) =>
                    store.setWindField(item.field, Number(event.target.value))
                  }
                />
                <span>{item.unit}</span>
              </div>
              {store.fieldErrors[item.field] ? (
                <span className="field-error">{store.fieldErrors[item.field]}</span>
              ) : null}
            </label>
          ))}
        </div>
      </section>

      <section className="control-section">
        <div className="section-title">
          <h3>Uncertainty</h3>
          <output>{store.numRuns} runs</output>
        </div>
        <input
          aria-label="Monte Carlo runs"
          max={15}
          min={5}
          step={1}
          type="range"
          value={store.numRuns}
          onChange={(event) => store.setNumRuns(Number(event.target.value))}
        />
        {store.fieldErrors.num_runs ? (
          <p className="field-error">{store.fieldErrors.num_runs}</p>
        ) : null}
      </section>

      <section className="control-section">
        <div className="section-title">
          <h3>Map Layers</h3>
          <span>WebGL overlays</span>
        </div>
        <div className="layer-list">
          {Object.entries(store.layers).map(([layer, enabled]) => (
            <label className="toggle-row" key={layer}>
              <span>{layerLabel(layer)}</span>
              <input
                checked={enabled}
                type="checkbox"
                onChange={(event) =>
                  store.setLayer(
                    layer as keyof typeof store.layers,
                    event.target.checked,
                  )
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
            value={store.burnOpacity}
            onChange={(event) => store.setBurnOpacity(Number(event.target.value))}
          />
        </label>
        <label className="field">
          <span>Terrain exaggeration</span>
          <input
            max={3}
            min={1}
            step={0.1}
            type="range"
            value={store.terrainExaggeration}
            onChange={(event) => store.setTerrainExaggeration(Number(event.target.value))}
          />
        </label>
      </section>

      {store.progress ? (
        <section className="progress-card">
          <div className="progress-card__top">
            <strong>{store.progress.phase}</strong>
            <span>
              {store.progress.completedRuns} / {store.progress.totalRuns}
            </span>
          </div>
          <progress value={store.progress.completedRuns} max={store.progress.totalRuns} />
          <div className="progress-card__footer">
            <span>
              elapsed {store.progress.elapsedSec.toFixed(1)}s, eta{" "}
              {store.progress.etaSec.toFixed(1)}s
            </span>
            <button
              className="secondary-button"
              type="button"
              onClick={cancelSimulation}
            >
              Cancel
            </button>
          </div>
          <div className="fire-preview" aria-hidden="true" />
        </section>
      ) : null}

      {store.apiError ? <p className="api-error">{store.apiError}</p> : null}

      <button
        className="run-button"
        type="button"
        disabled={running}
        onClick={() => void runSimulation()}
      >
        {running ? "Running Simulation…" : "Run Simulation"}
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
  return layer.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
}

function demoStepIndex(store: SimulationStore): number {
  // Step 5: has a previous result (re-run done)
  if (store.previousResult) return 5;
  // Step 4: has a result (simulation complete)
  if (store.status === "complete") return 4;
  // Step 3: simulation running
  if (store.status === "running") return 3;
  // Step 2: wind has been fetched live
  if (store.windMode === "live") return 2;
  // Step 1: ignition differs from default (user set it)
  if (store.selectIgnitionMode === false && store.ignition.lat !== 0) return 1;
  return 0;
}
