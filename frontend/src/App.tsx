import { useEffect, useRef, useState } from "react";
import { HeaderBar } from "./components/HeaderBar";
import { ToastContainer } from "./components/ToastContainer";
import { useSimulationStore } from "./stores/simulationStore";
import { useToasts } from "./context/useToasts";
import { ControlPanel } from "./features/controls/ControlPanel";
import { LandingPage } from "./features/landing/LandingPage";
import { MapView } from "./features/map/MapView";
import { ResultsPanel } from "./features/results/ResultsPanel";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { useSimulation } from "./hooks/useSimulation";
import { apiClient } from "./services/api";

export default function App() {
  const [showLanding, setShowLanding] = useState(true);
  const setScenarios = useSimulationStore((s) => s.setScenarios);
  const selectScenario = useSimulationStore((s) => s.selectScenario);
  const selectedScenarioName = useSimulationStore((s) => s.selectedScenarioName);
  const demoMode = useSimulationStore((s) => s.demoMode);
  const { fetchLiveWind } = useSimulation();
  const { pushToast } = useToasts();
  const demoWindFetched = useRef(false);

  useKeyboardShortcuts();

  useEffect(() => {
    let active = true;

    apiClient
      .fetchScenarios()
      .then((scenarios) => {
        if (!active) return;
        setScenarios(scenarios);
        const campFire = scenarios.find((s) => s.name.toLowerCase().includes("camp fire"));
        if (campFire && selectedScenarioName === "Custom scenario") {
          selectScenario(campFire);
        }
        if (scenarios.length === 0) {
          pushToast({ tone: "warning", title: "No scenarios available", message: "The scenarios endpoint returned an empty list." });
        }
      })
      .catch(() => {
        if (!active) return;
        setScenarios([]);
        pushToast({ tone: "critical", title: "Scenarios failed to load", message: "Could not fetch scenario presets from the API. Check the backend connection." });
      });

    return () => { active = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (demoMode && !demoWindFetched.current) {
      demoWindFetched.current = true;
      void fetchLiveWind();
    }
    if (!demoMode) {
      demoWindFetched.current = false;
    }
  }, [fetchLiveWind, demoMode]);

  const panels = useSimulationStore((s) => s.panels);

  const ccClass = [
    "command-center",
    !panels.controls && "controls-closed",
    !panels.results && "results-closed",
  ].filter(Boolean).join(" ");

  if (showLanding) {
    return (
      <>
        <LandingPage onLaunch={() => setShowLanding(false)} />
        <ToastContainer />
      </>
    );
  }

  return (
    <div className="app-shell">
      <HeaderBar />
      <div className={ccClass}>
        <ControlPanel />
        <MapView />
        <ResultsPanel />
      </div>
      <ToastContainer />
      <div className="viewport-too-small" role="alert" aria-live="polite">
        <strong>evacu8 requires a viewport of at least 1024px wide.</strong>
        <span>Please use a desktop browser at 1280×800 or larger.</span>
      </div>
    </div>
  );
}
