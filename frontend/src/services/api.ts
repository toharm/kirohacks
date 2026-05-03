import { createLiveApiClient } from "./liveApiClient";
import { createMockApiClient } from "./mockApiClient";
import type { ApiClient, ApiMode } from "../types/api";
export { ApiRequestError, ApiValidationError } from "./apiErrors";

export function createApiClient(): ApiClient {
  const mode = (import.meta.env.VITE_API_MODE ?? "mock") as ApiMode;
  return mode === "live" ? createLiveApiClient() : createMockApiClient();
}

export const apiClient = createApiClient();

export function apiModeLabel() {
  return (import.meta.env.VITE_API_MODE ?? "mock") === "live" ? "Live API" : "Mock API";
}
