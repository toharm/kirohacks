/**
 * EvacuAI API Service Layer
 *
 * Provides a unified interface for API communication with support for
 * both live backend and mock data modes.
 *
 * @see src/types/api.ts for type definitions
 */

import type {
  SimulateRequest,
  SimulateResponse,
  SimulationProgress,
  SimulationResults,
  WindData,
  ScenarioPreset,
  ApiError,
} from '../types/api';

// ============================================================================
// API Interface
// ============================================================================

/**
 * Progress callback for simulation polling
 */
export type ProgressCallback = (progress: SimulationProgress) => void;

/**
 * EvacuAI API interface
 * Implemented by both LiveApiClient and MockApiClient
 */
export interface EvacuAIApi {
  /**
   * Submit a simulation request
   * @param request Simulation parameters
   * @param onProgress Optional callback for progress updates during polling
   * @returns Complete simulation results
   * @throws ApiError on validation or network errors
   */
  simulate(
    request: SimulateRequest,
    onProgress?: ProgressCallback
  ): Promise<SimulationResults>;

  /**
   * Get results for a running or completed simulation
   * @param jobId Job identifier from simulate response
   * @returns Progress (if running) or complete results
   * @throws ApiError on network errors
   */
  getResults(jobId: string): Promise<SimulationProgress | SimulationResults>;

  /**
   * Fetch current wind conditions for a location
   * @param lat Latitude
   * @param lon Longitude
   * @returns Wind data from NWS or fallback
   * @throws ApiError on network errors
   */
  getWind(lat: number, lon: number): Promise<WindData>;

  /**
   * Get available scenario presets
   * @returns Array of scenario presets
   * @throws ApiError on network errors
   */
  getScenarios(): Promise<ScenarioPreset[]>;
}

// ============================================================================
// API Client Factory
// ============================================================================

/**
 * API mode from environment
 */
export type ApiMode = 'mock' | 'live';

/**
 * Get the current API mode from environment
 */
export function getApiMode(): ApiMode {
  const mode = import.meta.env.VITE_API_MODE;
  if (mode === 'live') {
    return 'live';
  }
  return 'mock'; // Default to mock for safety
}

/**
 * Get the API base URL from environment
 */
export function getApiBaseUrl(): string {
  return import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
}

/**
 * Create an API client based on environment configuration
 * @returns EvacuAIApi implementation (MockApiClient or LiveApiClient)
 */
export async function createApiClient(): Promise<EvacuAIApi> {
  const mode = getApiMode();

  if (mode === 'live') {
    const { LiveApiClient } = await import('./liveApiClient');
    return new LiveApiClient(getApiBaseUrl());
  }

  const { MockApiClient } = await import('./mockApiClient');
  return new MockApiClient();
}

// ============================================================================
// Singleton API Instance
// ============================================================================

let apiInstance: EvacuAIApi | null = null;
let apiInitPromise: Promise<EvacuAIApi> | null = null;

/**
 * Get the singleton API client instance
 * Lazily initializes on first call
 */
export async function getApi(): Promise<EvacuAIApi> {
  if (apiInstance) {
    return apiInstance;
  }

  if (!apiInitPromise) {
    apiInitPromise = createApiClient().then((client) => {
      apiInstance = client;
      return client;
    });
  }

  return apiInitPromise;
}

/**
 * Reset the API instance (useful for testing)
 */
export function resetApi(): void {
  apiInstance = null;
  apiInitPromise = null;
}

// ============================================================================
// Re-export types for convenience
// ============================================================================

export type {
  SimulateRequest,
  SimulateResponse,
  SimulationProgress,
  SimulationResults,
  WindData,
  ScenarioPreset,
  ApiError,
};
