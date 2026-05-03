import { useEffect } from "react";
import { useSimulationState } from "../context/useSimulationState";
import type { ScenarioPreset } from "../types/api";

export function useKeyboardShortcuts() {
  const { state, dispatch } = useSimulationState();

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "d") {
        return;
      }

      event.preventDefault();
      const enabled = !state.demoMode;
      dispatch({ type: "demoModeSet", enabled });

      if (enabled) {
        const campFireScenario = state.scenarios.find((scenario: ScenarioPreset) =>
          scenario.name.toLowerCase().includes("camp fire"),
        );
        if (campFireScenario) {
          dispatch({ type: "scenarioSelected", scenario: campFireScenario });
        }
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [dispatch, state.demoMode, state.scenarios]);
}
