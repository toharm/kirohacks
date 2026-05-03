/**
 * useSimulation Hook
 *
 * Custom hook for consuming simulation context with typed dispatch helpers
 * and memoized selectors for derived state.
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

export function useSimulationState(): SimulationState {
  const state = useContext(SimulationStateContext);
  if (state === null) {
    throw new Error('useSimulationState must be used within a SimulationProvider');
  }
  return state;
}

export function useSimulationDispatch(): React.Dispatch<SimulationAction> {
  const dispatch = useContext(SimulationDispatchContext);
  if (dispatch === null) {
    throw new Error('useSimulationDispatch must be used within a SimulationProvider');
  }
  return dispatch;
}

// ============================================================================
// Main Hook
// ============================================================================

export function useSimulation() {
  const state = useSimulationState();
  const dispatch = useSimulationDispatch();

  const setIgnition = useCallback(
    (point: { lat: number; lon: number } | null) => {
      dispatch({ type: 'SET_IGNITION', payload: point });
    },
    [dispatch]
  );

  const setRegion = useCallback(
    (region: string | null) => {
      dispatch({ type: 'SET_REGION', payload: region });
    },
    [dispatch]
  );

  const setWind = useCallback(
    (params: Partial<WindParameters>) => {
      dispatch({ type: 'SET_WIND', payload: params });
    },
    [dispatch]
  );

  const setWindFromData = useCallback(
    (windData: WindData) => {
      dispatch({ type: 'SET_WIND', payload: windDataToParams(windData) });
    },
    [dispatch]
  );

  const setScenario = useCallback(
    (scenarioName: string | null) => {
      dispatch({ type: 'SET_SCENARIO', payload: scenarioName });
    },
    [dispatch]
  );

  const applyScenario = useCallback(
    (scenario: ScenarioPreset) => {
      dispatch({ type: 'SET_SCENARIO', payload: scenario.name });
      dispatch({ type: 'SET_IGNITION', payload: scenario.ignition_point });
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

  const setMonteCarloRuns = useCallback(
    (runs: number) => {
      dispatch({ type: 'SET_MC_RUNS', payload: runs });
    },
    [dispatch]
  );

  const startSimulation = useCallback(() => {
    dispatch({ type: 'SUBMIT_SIMULATION' });
  }, [dispatch]);

  const updateProgress = useCallback(
    (completed: number, total: number) => {
      dispatch({ type: 'UPDATE_PROGRESS', payload: { completed, total } });
    },
    [dispatch]
  );

  const setResults = useCallback(
    (results: SimulationResults) => {
      dispatch({ type: 'SET_RESULTS', payload: results });
    },
    [dispatch]
  );

  const setError = useCallback(
    (error: string | null) => {
      dispatch({ type: 'SET_ERROR', payload: error });
    },
    [dispatch]
  );

  const selectZone = useCallback(
    (zoneId: string | null) => {
      dispatch({ type: 'SELECT_ZONE', payload: zoneId });
    },
    [dispatch]
  );

  const setAnimationTimestep = useCallback(
    (timestep: number) => {
      dispatch({ type: 'SET_ANIMATION_TIMESTEP', payload: timestep });
    },
    [dispatch]
  );

  const toggleAnimation = useCallback(() => {
    dispatch({ type: 'TOGGLE_ANIMATION' });
  }, [dispatch]);

  const toggleLayer = useCallback(
    (layer: keyof VisibleLayers) => {
      dispatch({ type: 'TOGGLE_LAYER', payload: layer });
    },
    [dispatch]
  );

  const setTerrainExaggeration = useCallback(
    (exaggeration: number) => {
      dispatch({ type: 'SET_TERRAIN_EXAGGERATION', payload: exaggeration });
    },
    [dispatch]
  );

  const storePreviousResults = useCallback(() => {
    dispatch({ type: 'STORE_PREVIOUS_RESULTS' });
  }, [dispatch]);

  const resetSimulation = useCallback(() => {
    dispatch({ type: 'RESET_SIMULATION' });
  }, [dispatch]);

  // -------------------------------------------------------------------------
  // Selectors
  // -------------------------------------------------------------------------

  const canRunSimulation = useMemo(() => {
    return state.ignitionPoint !== null && state.jobStatus !== 'running';
  }, [state.ignitionPoint, state.jobStatus]);

  const isSimulating = useMemo(() => {
    return state.jobStatus === 'running';
  }, [state.jobStatus]);

  const hasResults = useMemo(() => state.currentResults !== null, [state.currentResults]);

  const hasComparison = useMemo(() => {
    return state.currentResults !== null && state.previousResults !== null;
  }, [state.currentResults, state.previousResults]);

  const progressPercentage = useMemo(() => {
    if (!state.progress) return 0;
    return Math.round((state.progress.completed / state.progress.total) * 100);
  }, [state.progress]);

  const selectedZone = useMemo(() => {
    if (!state.selectedZoneId || !state.currentResults) return null;
    return state.currentResults.zones.features.find(
      (zone) => zone.properties.zone_id === state.selectedZoneId
    ) ?? null;
  }, [state.selectedZoneId, state.currentResults]);

  const selectedZoneRoutes = useMemo(() => {
    if (!state.selectedZoneId || !state.currentResults) return [];
    return state.currentResults.routes.filter(
      (route) => route.zone_id === state.selectedZoneId
    );
  }, [state.selectedZoneId, state.currentResults]);

  return {
    state,
    dispatch,

    // Dispatch helpers
    setIgnition,
    setRegion,
    setWind,
    setWindFromData,
    setScenario,
    applyScenario,
    setMonteCarloRuns,
    startSimulation,
    updateProgress,
    setResults,
    setError,
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
  };
}

export type UseSimulationReturn = ReturnType<typeof useSimulation>;
