import { ApiRequestError, ApiValidationError } from "./apiErrors";
import type {
  ApiClient,
  ApiValidationIssue,
  ScenarioPreset,
  SimulationProgress,
  SimulationRequest,
  SimulationResponse,
  WindResponse,
} from "../types/api";

interface PendingSimulationResponse {
  job_id: string;
  status?: string;
  total_runs?: number;
}

interface PollingSimulationResponse {
  job_id?: string;
  status?: string;
  runs_completed?: number;
  total_runs?: number;
  eta_seconds?: number;
  result?: SimulationResponse;
}

export function createLiveApiClient(): ApiClient {
  const baseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

  return {
    async fetchScenarios(region = "paradise-ca"): Promise<ScenarioPreset[]> {
      const params = new URLSearchParams({ region });
      return requestJson<ScenarioPreset[]>(`${baseUrl}/api/scenarios?${params.toString()}`);
    },

    async fetchWind(lat: number, lon: number): Promise<WindResponse> {
      const params = new URLSearchParams({ lat: String(lat), lon: String(lon) });
      return requestJson<WindResponse>(`${baseUrl}/api/wind?${params.toString()}`);
    },

    async runSimulation(
      simulationRequest: SimulationRequest,
      onProgress?: (progress: SimulationProgress) => void,
    ): Promise<SimulationResponse> {
      const response = await fetchWithTimeout(`${baseUrl}/api/simulate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(simulationRequest),
      });

      if (response.status === 422) {
        throw new ApiValidationError(await validationIssues(response));
      }

      if (response.status === 202) {
        const pending = (await response.json()) as PendingSimulationResponse;
        return pollSimulation(baseUrl, pending.job_id, simulationRequest.num_runs, onProgress);
      }

      if (!response.ok) {
        throw new ApiRequestError(await errorMessage(response));
      }

      onProgress?.({
        completedRuns: simulationRequest.num_runs,
        totalRuns: simulationRequest.num_runs,
        elapsedSec: 0,
        etaSec: 0,
        phase: "complete",
      });

      return response.json() as Promise<SimulationResponse>;
    },
  };
}

async function pollSimulation(
  baseUrl: string,
  jobId: string,
  totalRuns: number,
  onProgress?: (progress: SimulationProgress) => void,
): Promise<SimulationResponse> {
  for (;;) {
    await delay(1000);
    const response = await fetchWithTimeout(`${baseUrl}/api/results/${jobId}`);

    if (response.status === 202) {
      const progress = (await response.json()) as PollingSimulationResponse;
      onProgress?.({
        completedRuns: progress.runs_completed ?? 0,
        totalRuns: progress.total_runs ?? totalRuns,
        elapsedSec: 0,
        etaSec: progress.eta_seconds ?? 0,
        phase: progress.status ?? "running",
      });
      continue;
    }

    if (!response.ok) {
      throw new ApiRequestError(await errorMessage(response));
    }

    const complete = (await response.json()) as PollingSimulationResponse | SimulationResponse;
    if ("result" in complete && complete.result) {
      return complete.result;
    }
    return complete as SimulationResponse;
  }
}

async function requestJson<T>(url: string): Promise<T> {
  const response = await fetchWithTimeout(url);

  if (response.status === 422) {
    throw new ApiValidationError(await validationIssues(response));
  }

  if (!response.ok) {
    throw new ApiRequestError(await errorMessage(response));
  }

  return response.json() as Promise<T>;
}

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 12000);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ApiRequestError("Request timed out. Check the backend server and try again.");
    }
    throw new ApiRequestError("Network request failed. Verify that the FastAPI backend is running.");
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function validationIssues(response: Response): Promise<ApiValidationIssue[]> {
  const payload = (await response.json()) as {
    detail?: Array<{ loc?: Array<string | number>; msg?: string }>;
  };

  return (
    payload.detail?.map((issue) => ({
      field: String(issue.loc?.[issue.loc.length - 1] ?? "request"),
      message: issue.msg ?? "Invalid value",
    })) ?? [{ field: "request", message: "Invalid request payload" }]
  );
}

async function errorMessage(response: Response) {
  try {
    const payload = (await response.json()) as { detail?: string };
    return payload.detail ?? `API request failed with status ${response.status}`;
  } catch {
    return `API request failed with status ${response.status}`;
  }
}

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
