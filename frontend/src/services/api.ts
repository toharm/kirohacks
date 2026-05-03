/**
 * EvacuAI API Service Layer
 */

import type {
  SimulateRequest,
  SimulationProgress,
  SimulationResults,
  WindData,
  ScenarioPreset,
  ShelterData,
} from '../types/api';

export type ProgressCallback = (progress: SimulationProgress) => void;

export interface EvacuAIApi {
  simulate(
    request: SimulateRequest,
    onProgress?: ProgressCallback
  ): Promise<SimulationResults>;

  getResults(jobId: string): Promise<SimulationProgress | SimulationResults>;

  getWind(lat: number, lon: number): Promise<WindData>;

  getScenarios(region?: string): Promise<ScenarioPreset[]>;

  getRegions(): Promise<string[]>;

  getShelters(region?: string): Promise<ShelterData[]>;

  ingest(lat: number, lon: number, radius_km: number): Promise<void>;
}

function getApiBaseUrl(): string {
  return import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
}

let apiInstance: EvacuAIApi | null = null;
let apiInitPromise: Promise<EvacuAIApi> | null = null;

export async function getApi(): Promise<EvacuAIApi> {
  if (apiInstance) return apiInstance;

  if (!apiInitPromise) {
    apiInitPromise = createApiClient()
      .then((client) => {
        apiInstance = client;
        return client;
      })
      .catch((err) => {
        apiInitPromise = null; // allow retry on next call
        throw err;
      });
  }

  return apiInitPromise;
}

async function createApiClient(): Promise<EvacuAIApi> {
  const { LiveApiClient } = await import('./liveApiClient');
  return new LiveApiClient(getApiBaseUrl());
}

export type {
  SimulateRequest,
  SimulationProgress,
  SimulationResults,
  WindData,
  ScenarioPreset,
  ShelterData,
};
