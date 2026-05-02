/**
 * Simulation Context Provider
 *
 * React Context for simulation state management using useReducer.
 * Provides state and dispatch to all child components.
 *
 * @see simulationReducer.ts for state shape and actions
 */

import type { ReactNode, Dispatch } from 'react';
import { createContext, useReducer } from 'react';

import {
  simulationReducer,
  INITIAL_STATE,
  type SimulationState,
  type SimulationAction,
} from './simulationReducer';

// ============================================================================
// Context Types
// ============================================================================

/**
 * Context value containing state and dispatch
 */
export interface SimulationContextValue {
  state: SimulationState;
  dispatch: Dispatch<SimulationAction>;
}

// ============================================================================
// Context Creation
// ============================================================================

/**
 * Simulation state context
 * Provides access to the current simulation state
 */
export const SimulationStateContext = createContext<SimulationState | null>(null);

/**
 * Simulation dispatch context
 * Provides access to the dispatch function for state updates
 */
export const SimulationDispatchContext = createContext<Dispatch<SimulationAction> | null>(null);

// ============================================================================
// Provider Component
// ============================================================================

export interface SimulationProviderProps {
  children: ReactNode;
  /** Optional initial state override for testing */
  initialState?: Partial<SimulationState>;
}

/**
 * SimulationProvider component
 *
 * Wraps the application with simulation state context.
 * Uses useReducer for predictable state updates.
 *
 * @example
 * ```tsx
 * <SimulationProvider>
 *   <App />
 * </SimulationProvider>
 * ```
 */
export function SimulationProvider({
  children,
  initialState,
}: SimulationProviderProps): React.ReactElement {
  const [state, dispatch] = useReducer(
    simulationReducer,
    initialState ? { ...INITIAL_STATE, ...initialState } : INITIAL_STATE
  );

  return (
    <SimulationStateContext.Provider value={state}>
      <SimulationDispatchContext.Provider value={dispatch}>
        {children}
      </SimulationDispatchContext.Provider>
    </SimulationStateContext.Provider>
  );
}

// ============================================================================
// Re-exports for convenience
// ============================================================================

export type {
  SimulationState,
  SimulationAction,
  WindParameters,
  VisibleLayers,
} from './simulationReducer';

export {
  INITIAL_STATE,
  DEFAULT_WIND_PARAMS,
  DEFAULT_VISIBLE_LAYERS,
  windDataToParams,
} from './simulationReducer';
