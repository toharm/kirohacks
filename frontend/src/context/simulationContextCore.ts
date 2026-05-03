import { createContext, type Dispatch } from "react";
import type { SimulationAction, SimulationState } from "./simulationReducer";

export interface SimulationContextValue {
  state: SimulationState;
  dispatch: Dispatch<SimulationAction>;
}

export const SimulationContext = createContext<SimulationContextValue | null>(null);
