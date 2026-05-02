/**
 * Simulation State Reducer
 *
 * Pure reducer function for managing simulation state with discriminated union actions.
 * Follows React useReducer patterns with exhaustive switch handling.
 *
 * @see design.md for state shape specification
 */

import type { SimulationResults, WindData } from '../types/api';

// ============================================================================
// Wind Parameters Type
// ============================================================================

/**
 * Wind parameters for simulation input
 */
export interface WindParameters {
  /** Wind speed in mph */
  speed: number;
  /** Wind direction in degrees (0-360, 0=N, 90=E, 180=S, 270=W) */
  direction: number;
  /** Wind gust speed in mph */
  gust: number;
  /** Relative humidity percentage (0-100) */
  humidity: number;
  /** Data source indicator */
  source: 'nws' | 'fallback' | 'manual';
}

// ============================================================================
// Visible Layers Type
// ============================================================================

/**
 * Layer visibility toggles for the map
 */
export interface VisibleLayers {
  burnHeatmap: boolean;
  routes: boolean;
  zones: boolean;
  elevation: boolean;
  shelters: boolean;
  perimeter: boolean;
}

// ============================================================================
// Simulation State Interface
// ============================================================================

/**
 * Complete simulation state shape
 * Matches the design document specification
 */
export interface SimulationState {
  /** Selected ignition point coordinates */
  ignitionPoint: { lat: number; lon: number } | null;
  /** Wind parameters for simulation */
  windParams: WindParameters;
  /** Number of Monte Carlo simulation runs */
  monteCarloRuns: number;
  /** Selected scenario preset name */
  selectedScenario: string | null;
  /** Current job identifier */
  jobId: string | null;
  /** Current job status */
  jobStatus: 'idle' | 'submitting' | 'running' | 'complete' | 'error';
  /** Simulation progress */
  progress: { completed: number; total: number } | null;
  /** Current simulation results */
  currentResults: SimulationResults | null;
  /** Previous simulation results for comparison */
  previousResults: SimulationResults | null;
  /** Demo mode enabled */
  demoMode: boolean;
  /** Current demo step (1-5) */
  demoStep: number;
  /** API mode (live or mock) */
  apiMode: 'live' | 'mock';
  /** Currently selected zone ID */
  selectedZoneId: string | null;
  /** Current animation timestep in minutes */
  animationTimestep: number;
  /** Whether animation is playing */
  isAnimating: boolean;
  /** Terrain exaggeration factor (1.0-3.0) */
  terrainExaggeration: number;
  /** Layer visibility toggles */
  visibleLayers: VisibleLayers;
  /** Error message if any */
  error: string | null;
}

// ============================================================================
// Action Types (Discriminated Union)
// ============================================================================

export type SimulationAction =
  | { type: 'SET_IGNITION'; payload: { lat: number; lon: number } | null }
  | { type: 'SET_WIND'; payload: Partial<WindParameters> }
  | { type: 'SET_SCENARIO'; payload: string | null }
  | { type: 'SET_MC_RUNS'; payload: number }
  | { type: 'SUBMIT_SIMULATION' }
  | { type: 'UPDATE_PROGRESS'; payload: { completed: number; total: number } }
  | { type: 'SET_RESULTS'; payload: SimulationResults }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'TOGGLE_DEMO_MODE' }
  | { type: 'SET_DEMO_STEP'; payload: number }
  | { type: 'SELECT_ZONE'; payload: string | null }
  | { type: 'SET_ANIMATION_TIMESTEP'; payload: number }
  | { type: 'TOGGLE_ANIMATION' }
  | { type: 'TOGGLE_LAYER'; payload: keyof VisibleLayers }
  | { type: 'SET_TERRAIN_EXAGGERATION'; payload: number }
  | { type: 'STORE_PREVIOUS_RESULTS' }
  | { type: 'RESET_SIMULATION' };

// ============================================================================
// Initial State
// ============================================================================

/**
 * Default wind parameters (14 mph SW, 22 gust, 18% humidity)
 * Based on typical fire weather conditions
 */
export const DEFAULT_WIND_PARAMS: WindParameters = {
  speed: 14,
  direction: 225, // SW wind (blowing from SW)
  gust: 22,
  humidity: 18,
  source: 'fallback',
};

/**
 * Default layer visibility (all layers visible)
 */
export const DEFAULT_VISIBLE_LAYERS: VisibleLayers = {
  burnHeatmap: true,
  routes: true,
  zones: true,
  elevation: true,
  shelters: true,
  perimeter: true,
};

/**
 * Get API mode from environment
 */
function getInitialApiMode(): 'live' | 'mock' {
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_MODE === 'live') {
    return 'live';
  }
  return 'mock';
}

/**
 * Initial simulation state
 */
export const INITIAL_STATE: SimulationState = {
  ignitionPoint: null,
  windParams: DEFAULT_WIND_PARAMS,
  monteCarloRuns: 500,
  selectedScenario: null,
  jobId: null,
  jobStatus: 'idle',
  progress: null,
  currentResults: null,
  previousResults: null,
  demoMode: false,
  demoStep: 0,
  apiMode: getInitialApiMode(),
  selectedZoneId: null,
  animationTimestep: 0,
  isAnimating: false,
  terrainExaggeration: 1.0,
  visibleLayers: DEFAULT_VISIBLE_LAYERS,
  error: null,
};

// ============================================================================
// Reducer Function
// ============================================================================

/**
 * Pure reducer function for simulation state
 * Uses exhaustive switch for type safety
 */
export function simulationReducer(
  state: SimulationState,
  action: SimulationAction
): SimulationState {
  switch (action.type) {
    case 'SET_IGNITION':
      return {
        ...state,
        ignitionPoint: action.payload,
        // Clear error when user takes action
        error: null,
      };

    case 'SET_WIND':
      return {
        ...state,
        windParams: {
          ...state.windParams,
          ...action.payload,
        },
        error: null,
      };

    case 'SET_SCENARIO':
      return {
        ...state,
        selectedScenario: action.payload,
        error: null,
      };

    case 'SET_MC_RUNS':
      return {
        ...state,
        monteCarloRuns: Math.max(50, Math.min(1000, action.payload)),
        error: null,
      };

    case 'SUBMIT_SIMULATION':
      return {
        ...state,
        jobStatus: 'running',
        progress: { completed: 0, total: state.monteCarloRuns },
        error: null,
      };

    case 'UPDATE_PROGRESS':
      return {
        ...state,
        progress: action.payload,
      };

    case 'SET_RESULTS':
      return {
        ...state,
        jobStatus: 'complete',
        currentResults: action.payload,
        progress: null,
        animationTimestep: 0,
        isAnimating: false,
      };

    case 'SET_ERROR':
      return {
        ...state,
        jobStatus: action.payload ? 'error' : state.jobStatus,
        error: action.payload,
        progress: null,
      };

    case 'TOGGLE_DEMO_MODE':
      return {
        ...state,
        demoMode: !state.demoMode,
        demoStep: !state.demoMode ? 1 : 0,
      };

    case 'SET_DEMO_STEP':
      return {
        ...state,
        demoStep: action.payload,
      };

    case 'SELECT_ZONE':
      return {
        ...state,
        selectedZoneId: action.payload,
      };

    case 'SET_ANIMATION_TIMESTEP':
      return {
        ...state,
        animationTimestep: Math.max(0, action.payload),
      };

    case 'TOGGLE_ANIMATION':
      return {
        ...state,
        isAnimating: !state.isAnimating,
      };

    case 'TOGGLE_LAYER':
      return {
        ...state,
        visibleLayers: {
          ...state.visibleLayers,
          [action.payload]: !state.visibleLayers[action.payload],
        },
      };

    case 'SET_TERRAIN_EXAGGERATION':
      return {
        ...state,
        terrainExaggeration: Math.max(1.0, Math.min(3.0, action.payload)),
      };

    case 'STORE_PREVIOUS_RESULTS':
      return {
        ...state,
        previousResults: state.currentResults,
      };

    case 'RESET_SIMULATION':
      return {
        ...INITIAL_STATE,
        apiMode: state.apiMode,
        demoMode: state.demoMode,
        demoStep: state.demoStep,
        visibleLayers: state.visibleLayers,
        terrainExaggeration: state.terrainExaggeration,
      };

    default:
      // Exhaustive check - TypeScript will error if a case is missing
      return action satisfies never;
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert WindData from API to WindParameters
 */
export function windDataToParams(windData: WindData): WindParameters {
  return {
    speed: windData.wind_speed,
    direction: windData.wind_direction,
    gust: windData.wind_gust,
    humidity: windData.relative_humidity,
    source: windData.source,
  };
}
