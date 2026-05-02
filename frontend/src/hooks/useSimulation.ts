/**
 * useSimulation Hook
 *
 * Custom hook for consuming simulation context with typed dispatch helpers
 * and memoized selectors for derived state.
 *
 * @see SimulationContext.tsx for context providers
 */

import { useContext, useCallback, useMemo } from 'react';

import {
  SimulationStateContext,
  SimulationDispatchContext,
  windDataToParams,
  type SimulationState,
  type SimulationAction,
  type WindParameters,
  type VisibleLayers,
} from '../context/SimulationContext';

import type { SimulationResults, WindData, ScenarioPreset } from '../types/api';

// ============================================================================
// Context Hooks
// ============================================================================

/**
 * Hook to access simulation state
 * @throws Error if used outside SimulationProvider
 */
export function useSimulationState(): SimulationState {
  const state = useContext(SimulationStateContext);
  if (state === null) {
    throw new Error('useSimulationState must be used within a SimulationProvider');
  }
  return state;
}

/**
 * Hook to access simulation dispatch
 * @throws Error if used outside SimulationProvider
 */
export function useSimulationDispatch(): React.Dispatch<SimulationAction> {
  const dispatch = useContext(SimulationDispatchContext);
  if (dispatch === null) {
    throw new Error('useSimulationDispatch must be used within a SimulationProvider');
  }
  return dispatch;
}

// ============================================================================
// Main Hook with Dispatch Helpers
// ============================================================================

/**
 * Complete simulation hook with state, dispatch, and helper functions
 */
export function useSimulation() {
  const state = useSimulationState();
  const dispatch = useSimulationDispatch();

  // -------------------------------------------------------------------------
  // Dispatch Helpers
  // -------------------------------------------------------------------------

  /**
   * Set ignition point coordinates
   */
  const setIgnition = useCallback(
    (point: { lat: number; lon: number } | null) => {
      dispatch({ type: 'SET_IGNITION', payload: point });
    },
    [dispatch]
  );

  /**
   * Update wind parameters (partial update supported)
   */
  const setWind = useCallback(
    (params: Partial<WindParameters>) => {
      dispatch({ type: 'SET_WIND', payload: params });
    },
    [dispatch]
  );

  /**
   * Set wind from API WindData response
   */
  const setWindFromData = useCallback(
    (windData: WindData) => {
      dispatch({ type: 'SET_WIND', payload: windDataToParams(windData) });
    },
    [dispatch]
  );

  /**
   * Select a scenario preset
   */
  const setScenario = useCallback(
    (scenarioName: string | null) => {
      dispatch({ type: 'SET_SCENARIO', payload: scenarioName });
    },
    [dispatch]
  );

  /**
   * Apply a scenario preset (sets ignition, wind, and scenario name)
   */
  const applyScenario = useCallback(
    (scenario: ScenarioPreset) => {
      dispatch({ type: 'SET_SCENARIO', payload: scenario.name });
      dispatch({
        type: 'SET_IGNITION',
        payload: scenario.ignition_point,
      });
      dispatch({
        type: 'SET_WIND',
        payload: {
          speed: scenario.wind_speed,
          direction: scenario.wind_direction,
          gust: scenario.wind_gust,
          humidity: scenario.relative_humidity,
          source: 'manual',
        },
      });
    },
    [dispatch]
  );

  /**
   * Set number of Monte Carlo runs
   */
  const setMonteCarloRuns = useCallback(
    (runs: number) => {
      dispatch({ type: 'SET_MC_RUNS', payload: runs });
    },
    [dispatch]
  );

  /**
   * Start simulation (transitions to running state)
   */
  const startSimulation = useCallback(() => {
    dispatch({ type: 'SUBMIT_SIMULATION' });
  }, [dispatch]);

  /**
   * Update simulation progress
   */
  const updateProgress = useCallback(
    (completed: number, total: number) => {
      dispatch({ type: 'UPDATE_PROGRESS', payload: { completed, total } });
    },
    [dispatch]
  );

  /**
   * Set simulation results
   */
  const setResults = useCallback(
    (results: SimulationResults) => {
      dispatch({ type: 'SET_RESULTS', payload: results });
    },
    [dispatch]
  );

  /**
   * Set error message
   */
  const setError = useCallback(
    (error: string | null) => {
      dispatch({ type: 'SET_ERROR', payload: error });
    },
    [dispatch]
  );

  /**
   * Toggle demo mode
   */
  const toggleDemoMode = useCallback(() => {
    dispatch({ type: 'TOGGLE_DEMO_MODE' });
  }, [dispatch]);

  /**
   * Set demo step
   */
  const setDemoStep = useCallback(
    (step: number) => {
      dispatch({ type: 'SET_DEMO_STEP', payload: step });
    },
    [dispatch]
  );

  /**
   * Select a zone by ID
   */
  const selectZone = useCallback(
    (zoneId: string | null) => {
      dispatch({ type: 'SELECT_ZONE', payload: zoneId });
    },
    [dispatch]
  );

  /**
   * Set animation timestep
   */
  const setAnimationTimestep = useCallback(
    (timestep: number) => {
      dispatch({ type: 'SET_ANIMATION_TIMESTEP', payload: timestep });
    },
    [dispatch]
  );

  /**
   * Toggle animation playback
   */
  const toggleAnimation = useCallback(() => {
    dispatch({ type: 'TOGGLE_ANIMATION' });
  }, [dispatch]);

  /**
   * Toggle a specific layer's visibility
   */
  const toggleLayer = useCallback(
    (layer: keyof VisibleLayers) => {
      dispatch({ type: 'TOGGLE_LAYER', payload: layer });
    },
    [dispatch]
  );

  /**
   * Set terrain exaggeration factor
   */
  const setTerrainExaggeration = useCallback(
    (exaggeration: number) => {
      dispatch({ type: 'SET_TERRAIN_EXAGGERATION', payload: exaggeration });
    },
    [dispatch]
  );

  /**
   * Store current results as previous (for comparison)
   */
  const storePreviousResults = useCallback(() => {
    dispatch({ type: 'STORE_PREVIOUS_RESULTS' });
  }, [dispatch]);

  /**
   * Reset simulation to initial state
   */
  const resetSimulation = useCallback(() => {
    dispatch({ type: 'RESET_SIMULATION' });
  }, [dispatch]);

  // -------------------------------------------------------------------------
  // Memoized Selectors
  // -------------------------------------------------------------------------

  /**
   * Whether simulation can be run (has required inputs)
   */
  const canRunSimulation = useMemo(() => {
    return (
      state.ignitionPoint !== null &&
      state.jobStatus !== 'submitting' &&
      state.jobStatus !== 'running'
    );
  }, [state.ignitionPoint, state.jobStatus]);

  /**
   * Whether simulation is currently in progress
   */
  const isSimulating = useMemo(() => {
    return state.jobStatus === 'submitting' || state.jobStatus === 'running';
  }, [state.jobStatus]);

  /**
   * Whether results are available
   */
  const hasResults = useMemo(() => {
    return state.currentResults !== null;
  }, [state.currentResults]);

  /**
   * Whether comparison is available (has both current and previous results)
   */
  const hasComparison = useMemo(() => {
    return state.currentResults !== null && state.previousResults !== null;
  }, [state.currentResults, state.previousResults]);

  /**
   * Progress percentage (0-100)
   */
  const progressPercentage = useMemo(() => {
    if (!state.progress) return 0;
    return Math.round((state.progress.completed / state.progress.total) * 100);
  }, [state.progress]);

  /**
   * Currently selected zone data
   */
  const selectedZone = useMemo(() => {
    if (!state.selectedZoneId || !state.currentResults) return null;
    return state.currentResults.zones.features.find(
      (zone) => zone.properties.zone_id === state.selectedZoneId
    ) ?? null;
  }, [state.selectedZoneId, state.currentResults]);

  /**
   * Routes for the selected zone
   */
  const selectedZoneRoutes = useMemo(() => {
    if (!state.selectedZoneId || !state.currentResults) return [];
    return state.currentResults.routes.filter(
      (route) => route.zone_id === state.selectedZoneId
    );
  }, [state.selectedZoneId, state.currentResults]);

  /**
   * Whether using mock API
   */
  const isMockMode = useMemo(() => {
    return state.apiMode === 'mock';
  }, [state.apiMode]);

  // -------------------------------------------------------------------------
  // Return Value
  // -------------------------------------------------------------------------

  return {
    // State
    state,
    dispatch,

    // Dispatch helpers
    setIgnition,
    setWind,
    setWindFromData,
    setScenario,
    applyScenario,
    setMonteCarloRuns,
    startSimulation,
    updateProgress,
    setResults,
    setError,
    toggleDemoMode,
    setDemoStep,
    selectZone,
    setAnimationTimestep,
    toggleAnimation,
    toggleLayer,
    setTerrainExaggeration,
    storePreviousResults,
    resetSimulation,

    // Selectors
    canRunSimulation,
    isSimulating,
    hasResults,
    hasComparison,
    progressPercentage,
    selectedZone,
    selectedZoneRoutes,
    isMockMode,
  };
}

// ============================================================================
// Type Exports
// ============================================================================

export type UseSimulationReturn = ReturnType<typeof useSimulation>;
