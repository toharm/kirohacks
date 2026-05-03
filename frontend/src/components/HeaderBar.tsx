import { apiModeLabel } from "../services/api";
import { useSimulationState } from "../context/useSimulationState";
import { SimulationStatus } from "./SimulationStatus";
import { WindRose } from "./WindRose";

export function HeaderBar() {
  const { state, dispatch } = useSimulationState();

  return (
    <header className="header-bar">
      <div className="brand-lockup">
        <button
          className="icon-button header-bar__mobile-toggle"
          type="button"
          aria-label="Open controls"
          onClick={() => dispatch({ type: "panelSet", panel: "controls", open: true })}
        >
          <span aria-hidden="true">M</span>
        </button>
        <div className="brand-mark" aria-hidden="true">E</div>
        <div>
          <strong className="brand-wordmark">EvacuAI</strong>
          <span className="brand-subtitle">{apiModeLabel()}</span>
        </div>
      </div>

      <div className="header-bar__scenario">
        <span>Scenario</span>
        <strong>{state.selectedScenarioName}</strong>
      </div>

      <div className="header-bar__right">
        <SimulationStatus status={state.status} modifiedWind={state.modifiedWind} />
        <WindRose wind={state.wind} compact />
        <button
          className="icon-button header-bar__mobile-toggle"
          type="button"
          aria-label="Open results"
          onClick={() => dispatch({ type: "panelSet", panel: "results", open: true })}
        >
          <span aria-hidden="true">R</span>
        </button>
      </div>
    </header>
  );
}
