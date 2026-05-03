import { buildMockSimulation, defaultWind, scenarios } from "./mockData";
import type {
  ApiClient,
  ScenarioPreset,
  SimulationProgress,
  SimulationRequest,
  SimulationResponse,
  WindResponse,
} from "../types/api";

export function createMockApiClient(): ApiClient {
  return {
    async fetchScenarios(): Promise<ScenarioPreset[]> {
      await delay(100);
      return scenarios;
    },

    async fetchWind(): Promise<WindResponse> {
      await delay(100);
      return {
        conditions: defaultWind,
        source: "nws_live",
        forecast_text: "Dry northeast ridge winds with occasional gusts.",
      };
    },

    async runSimulation(
      request: SimulationRequest,
      onProgress?: (progress: SimulationProgress) => void,
    ): Promise<SimulationResponse> {
      const startedAt = Date.now();
      const ticks = [0.08, 0.18, 0.34, 0.52, 0.71, 0.88, 1];

      for (const fraction of ticks) {
        await delay(fraction === 1 ? 350 : 430);
        const elapsedSec = (Date.now() - startedAt) / 1000;
        const completedRuns = Math.round(request.num_runs * fraction);
        const remainingRuns = Math.max(0, request.num_runs - completedRuns);
        const runsPerSecond = completedRuns / Math.max(elapsedSec, 0.1);

        onProgress?.({
          completedRuns,
          totalRuns: request.num_runs,
          elapsedSec,
          etaSec: remainingRuns / Math.max(runsPerSecond, 1),
          phase: fraction < 0.34 ? "sampling wind futures" : fraction < 0.71 ? "routing exposed zones" : "aggregating viability",
        });
      }

      return buildMockSimulation(request);
    },
  };
}

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
