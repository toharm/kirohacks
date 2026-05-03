import { useEffect, useRef } from "react";
import { HeaderBar } from "./components/HeaderBar";
import { ToastContainer } from "./components/ToastContainer";
import { useSimulationState } from "./context/useSimulationState";
import { ControlPanel } from "./features/controls/ControlPanel";
import { MapView } from "./features/map/MapView";
import { ResultsPanel } from "./features/results/ResultsPanel";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { useSimulation } from "./hooks/useSimulation";
import { apiClient } from "./services/api";

export default function App() {
  const { state, dispatch } = useSimulationState();
  const { fetchLiveWind } = useSimulation();
  const demoWindFetched = useRef(false);

  useKeyboardShortcuts();

  useEffect(() => {
    let active = true;

    apiClient.fetchScenarios()
      .then((scenarios) => {
        if (!active) {
          return;
        }
        dispatch({ type: "scenariosLoaded", scenarios });
        const campFireScenario = scenarios.find((scenario) =>
          scenario.name.toLowerCase().includes("camp fire"),
        );
        if (campFireScenario && state.selectedScenarioName === "Custom scenario") {
          dispatch({ type: "scenarioSelected", scenario: campFireScenario });
        }
      })
      .catch(() => {
        if (active) {
          dispatch({ type: "scenariosLoaded", scenarios: [] });
        }
      });

    return () => {
      active = false;
    };
  }, [dispatch, state.selectedScenarioName]);

  useEffect(() => {
    if (state.demoMode && !demoWindFetched.current) {
      demoWindFetched.current = true;
      void fetchLiveWind();
    }
    if (!state.demoMode) {
      demoWindFetched.current = false;
    }
  }, [fetchLiveWind, state.demoMode]);

  return (
    <div className="app-shell">
      <HeaderBar />
      <div className="command-center">
        <ControlPanel />
        <MapView />
        <ResultsPanel />
      </div>
      <ToastContainer />
    </div>
  );
}
