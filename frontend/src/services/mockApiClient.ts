/**
 * Mock API Client for EvacuAI Frontend Development
 *
 * Implements EvacuAIApi interface with realistic mock data and simulated delays.
 * Enables frontend development without a running backend.
 */

import type {
  SimulateRequest,
  SimulationProgress,
  SimulationResults,
  WindData,
  ScenarioPreset,
} from '../types/api';
import type { EvacuAIApi, ProgressCallback } from './api';

// Import mock data
import mockSimulationResults from '../assets/mock/simulationResults.json';
import mockWindData from '../assets/mock/windData.json';
import mockScenarios from '../assets/mock/scenarios.json';

// ============================================================================
// Constants
// ============================================================================

/** Delay for quick API calls (wind, scenarios) in ms */
const QUICK_DELAY_MS = 100;

/** Total simulation time in ms */
const SIMULATION_TOTAL_MS = 3000;

/** Progress update interval in ms */
const PROGRESS_INTERVAL_MS = 200;

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Create a promise that resolves after a delay
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generate a random job ID
 */
function generateJobId(): string {
  return `mock-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

// ============================================================================
// Mock API Client Implementation
// ============================================================================

/**
 * Mock API client for development without backend
 */
export class MockApiClient implements EvacuAIApi {
  private runningJobs: Map<
    string,
    {
      request: SimulateRequest;
      startTime: number;
      totalRuns: number;
    }
  > = new Map();

  /**
   * Submit a simulation and simulate progressive completion
   */
  async simulate(
    request: SimulateRequest,
    onProgress?: ProgressCallback
  ): Promise<SimulationResults> {
    const jobId = generateJobId();
    const totalRuns = request.num_runs;
    const startTime = Date.now();

    // Store job info
    this.runningJobs.set(jobId, {
      request,
      startTime,
      totalRuns,
    });

    // Simulate progressive completion with progress callbacks
    const progressSteps = Math.ceil(SIMULATION_TOTAL_MS / PROGRESS_INTERVAL_MS);
    const runsPerStep = Math.ceil(totalRuns / progressSteps);

    for (let step = 0; step < progressSteps; step++) {
      await delay(PROGRESS_INTERVAL_MS);

      const completedRuns = Math.min((step + 1) * runsPerStep, totalRuns);
      const elapsedSeconds = (Date.now() - startTime) / 1000;

      const progress: SimulationProgress = {
        status: 'running',
        completed_runs: completedRuns,
        total_runs: totalRuns,
        elapsed_seconds: elapsedSeconds,
      };

      if (onProgress) {
        onProgress(progress);
      }

      // Check if complete
      if (completedRuns >= totalRuns) {
        break;
      }
    }

    // Clean up job tracking
    this.runningJobs.delete(jobId);

    // Return mock results with the job ID
    const results = this.getMockResults(jobId, request);
    return results;
  }

  /**
   * Get results for a job (simulates polling behavior)
   */
  async getResults(jobId: string): Promise<SimulationProgress | SimulationResults> {
    await delay(50); // Small delay to simulate network

    const job = this.runningJobs.get(jobId);

    if (!job) {
      // Job not found or completed - return mock results
      return this.getMockResults(jobId, {
        ignition_point: { lat: 39.7596, lon: -121.6219 },
        wind_speed: 14,
        wind_direction: 225,
        wind_gust: 22,
        relative_humidity: 18,
        num_runs: 500,
      });
    }

    // Calculate progress
    const elapsed = Date.now() - job.startTime;
    const progress = Math.min(elapsed / SIMULATION_TOTAL_MS, 1);
    const completedRuns = Math.floor(progress * job.totalRuns);

    if (completedRuns >= job.totalRuns) {
      // Simulation complete
      this.runningJobs.delete(jobId);
      return this.getMockResults(jobId, job.request);
    }

    // Still running
    return {
      status: 'running',
      completed_runs: completedRuns,
      total_runs: job.totalRuns,
      elapsed_seconds: elapsed / 1000,
    };
  }

  /**
   * Fetch mock wind data
   */
  async getWind(_lat: number, _lon: number): Promise<WindData> {
    await delay(QUICK_DELAY_MS);
    return mockWindData as WindData;
  }

  /**
   * Get mock scenario presets
   */
  async getScenarios(): Promise<ScenarioPreset[]> {
    await delay(QUICK_DELAY_MS);
    return mockScenarios as ScenarioPreset[];
  }

  /**
   * Generate mock results based on request parameters
   */
  private getMockResults(
    jobId: string,
    request: SimulateRequest
  ): SimulationResults {
    // Clone the mock results and customize based on request
    const results = JSON.parse(
      JSON.stringify(mockSimulationResults)
    ) as SimulationResults;

    // Update job ID
    results.job_id = jobId;

    // Adjust summary based on wind conditions
    // Higher wind speed = lower viability, higher failure risk
    const windFactor = Math.max(0.5, 1 - (request.wind_speed - 10) / 40);

    results.summary.baseline_avg_viability = Math.round(
      results.summary.baseline_avg_viability * windFactor
    );
    results.summary.optimized_avg_viability = Math.round(
      results.summary.optimized_avg_viability * windFactor
    );
    results.summary.improvement_percentage = Math.round(
      ((results.summary.optimized_avg_viability -
        results.summary.baseline_avg_viability) /
        results.summary.baseline_avg_viability) *
        100
    );

    // Adjust route viability scores
    results.routes = results.routes.map((route) => ({
      ...route,
      viability_score: Math.round(route.viability_score * windFactor),
    }));

    // Adjust zone viability
    results.zones.features = results.zones.features.map((zone) => ({
      ...zone,
      properties: {
        ...zone.properties,
        baseline_viability: Math.round(
          zone.properties.baseline_viability * windFactor
        ),
        optimized_viability: Math.round(
          zone.properties.optimized_viability * windFactor
        ),
        failure_risk_percentage: Math.round(
          Math.min(100, zone.properties.failure_risk_percentage / windFactor)
        ),
      },
    }));

    return results;
  }
}
