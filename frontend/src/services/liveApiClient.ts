/**
 * Live API Client for EvacuAI Backend
 *
 * Implements EvacuAIApi interface with real HTTP calls to the FastAPI backend.
 * Handles HTTP status codes, validation errors, and network failures.
 */

import type {
  SimulateRequest,
  SimulationProgress,
  SimulationResults,
  WindData,
  ScenarioPreset,
  ApiValidationError,
  ApiNetworkError,
  FieldError,
} from '../types/api';
import { isSimulationResults } from '../types/api';
import type { EvacuAIApi, ProgressCallback } from './api';

// ============================================================================
// Constants
// ============================================================================

/** Polling interval for simulation progress (ms) */
const POLL_INTERVAL_MS = 1000;

/** Maximum polling duration before timeout (ms) */
const POLL_TIMEOUT_MS = 300000; // 5 minutes

/** Request timeout (ms) */
const REQUEST_TIMEOUT_MS = 30000;

// ============================================================================
// Error Classes
// ============================================================================

/**
 * Custom error class for API validation errors (HTTP 422)
 */
export class ValidationError extends Error {
  public readonly type = 'validation' as const;
  public readonly detail: FieldError[];

  constructor(detail: FieldError[]) {
    const message = detail.map((e) => `${e.loc.join('.')}: ${e.msg}`).join('; ');
    super(message);
    this.name = 'ValidationError';
    this.detail = detail;
  }

  toApiError(): ApiValidationError {
    return {
      type: 'validation',
      detail: this.detail,
    };
  }
}

/**
 * Custom error class for network errors
 */
export class NetworkError extends Error {
  public readonly type = 'network' as const;
  public readonly cause?: Error;

  constructor(message: string, cause?: Error) {
    super(message);
    this.name = 'NetworkError';
    this.cause = cause;
  }

  toApiError(): ApiNetworkError {
    return {
      type: 'network',
      message: this.message,
      cause: this.cause,
    };
  }
}

// ============================================================================
// Live API Client Implementation
// ============================================================================

/**
 * Live API client that communicates with the EvacuAI FastAPI backend
 */
export class LiveApiClient implements EvacuAIApi {
  private readonly baseUrl: string;

  constructor(baseUrl: string) {
    // Remove trailing slash if present
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  /**
   * Make a fetch request with timeout and error handling
   */
  private async fetch<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      clearTimeout(timeoutId);

      // Handle validation errors (HTTP 422)
      if (response.status === 422) {
        const errorBody = await response.json();
        throw new ValidationError(errorBody.detail || []);
      }

      // Handle other error status codes
      if (!response.ok && response.status !== 202) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new NetworkError(
          `HTTP ${response.status}: ${errorText}`
        );
      }

      // Return response with status for caller to handle 202
      const data = await response.json();
      return { ...data, _httpStatus: response.status } as T & { _httpStatus: number };
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof ValidationError || error instanceof NetworkError) {
        throw error;
      }

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new NetworkError('Request timeout', error);
        }
        throw new NetworkError(error.message, error);
      }

      throw new NetworkError('Unknown error occurred');
    }
  }

  /**
   * Submit a simulation and poll for results
   */
  async simulate(
    request: SimulateRequest,
    onProgress?: ProgressCallback
  ): Promise<SimulationResults> {
    // Submit simulation request
    const submitResponse = await this.fetch<{ job_id: string }>(
      '/api/simulate',
      {
        method: 'POST',
        body: JSON.stringify(request),
      }
    );

    const jobId = submitResponse.job_id;

    // Poll for results
    const startTime = Date.now();

    while (Date.now() - startTime < POLL_TIMEOUT_MS) {
      const result = await this.getResults(jobId);

      if (isSimulationResults(result)) {
        return result;
      }

      // Report progress
      if (onProgress) {
        onProgress(result);
      }

      // Wait before next poll
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }

    throw new NetworkError('Simulation polling timeout exceeded');
  }

  /**
   * Get results for a job (may return progress or complete results)
   */
  async getResults(jobId: string): Promise<SimulationProgress | SimulationResults> {
    const response = await this.fetch<
      (SimulationProgress | SimulationResults) & { _httpStatus: number }
    >(`/api/results/${encodeURIComponent(jobId)}`);

    // Remove internal status tracking
    const { _httpStatus, ...data } = response;

    // HTTP 202 indicates still running
    if (_httpStatus === 202) {
      return data as SimulationProgress;
    }

    return data as SimulationResults;
  }

  /**
   * Fetch wind data for a location
   */
  async getWind(lat: number, lon: number): Promise<WindData> {
    const params = new URLSearchParams({
      lat: lat.toString(),
      lon: lon.toString(),
    });

    return this.fetch<WindData>(`/api/wind?${params}`);
  }

  /**
   * Get available scenario presets
   */
  async getScenarios(): Promise<ScenarioPreset[]> {
    return this.fetch<ScenarioPreset[]>('/api/scenarios');
  }
}
