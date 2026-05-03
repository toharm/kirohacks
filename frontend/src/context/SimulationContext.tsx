import { useReducer, type PropsWithChildren } from "react";
import {
  initialSimulationState,
  simulationReducer,
} from "./simulationReducer";
import { SimulationContext } from "./simulationContextCore";

export function SimulationProvider({ children }: PropsWithChildren) {
  const [state, dispatch] = useReducer(simulationReducer, initialSimulationState);

  return (
    <SimulationContext.Provider value={{ state, dispatch }}>
      {children}
    </SimulationContext.Provider>
  );
}
