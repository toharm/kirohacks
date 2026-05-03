import { useContext } from "react";
import { SimulationContext } from "./simulationContextCore";

export function useSimulationState() {
  const context = useContext(SimulationContext);

  if (!context) {
    throw new Error("useSimulationState must be used inside SimulationProvider");
  }

  return context;
}
