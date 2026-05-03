import { apiClient, ApiRequestError, ApiValidationError } from "../services/api";
import { useSimulationStore } from "../stores/simulationStore";
import type { SimulationStore } from "../stores/simulationStore";
import { useToasts } from "../context/useToasts";
import type { SimulationRequest, WindConditions } from "../types/api";

export function useSimulation() {
  const store = useSimulationStore() as SimulationStore;
  const { pushToast } = useToasts();

  async function fetchLiveWind() {
    store.setWindMode("live");
    try {
      const response = await apiClient.fetchWind(store.ignition.lat, store.ignition.lon);
      store.setWind(response.conditions, false);
      pushToast({
        tone: response.source === "fallback" ? "warning" : "success",
        title: response.source === "fallback" ? "Fallback wind loaded" : "Live wind loaded",
        message: response.forecast_text ?? "Wind fields updated from the API.",
      });
    } catch (error) {
      pushToast({
        tone: "critical",
        title: "Wind fetch failed",
        message: error instanceof Error ? error.message : "Unable to fetch live wind.",
      });
    }
  }

  async function runSimulation(options: { quickCompare?: boolean } = {}) {
    const wind = options.quickCompare ? shiftedWind(store.wind) : store.wind;
    const request = buildRequest(store, wind);
    const errors = validateRequest(request);

    if (Object.keys(errors).length > 0) {
      store.setFieldErrors(errors);
      pushToast({
        tone: "warning",
        title: "Check simulation inputs",
        message: "One or more values are outside the accepted range.",
      });
      return;
    }

    if (options.quickCompare) store.setWind(wind, true);

    const controller = store.startRun(options.quickCompare ? store.result : null);

    try {
      const result = await apiClient.runSimulation(
        request,
        (progress) => store.progressRun(progress),
        controller.signal,
      );
      store.completeRun(result, store.modifiedWind || options.quickCompare === true);
      pushToast({
        tone: "success",
        title: "Simulation complete",
        message: `${result.summary.runs_completed} Monte Carlo runs aggregated.`,
      });
    } catch (error) {
      if (controller.signal.aborted) return; // cancelled — store already reset by cancelRun

      if (error instanceof ApiValidationError) {
        store.setFieldErrors(
          Object.fromEntries(error.issues.map((i) => [i.field, i.message])),
        );
        pushToast({ tone: "warning", title: "Backend validation failed", message: "The API rejected one or more fields." });
        return;
      }

      // Surface 404 job-not-found as a toast (per polling contract)
      const message = error instanceof ApiRequestError || error instanceof Error
        ? error.message
        : "Simulation request failed.";
      const isNotFound = message.includes("not found");
      store.failRun(message);
      pushToast({ tone: isNotFound ? "warning" : "critical", title: isNotFound ? "Job not found" : "Simulation failed", message });
    }
  }

  function cancelSimulation() {
    store.cancelRun();
    pushToast({ tone: "warning", title: "Simulation cancelled", message: "The running simulation was stopped." });
  }

  function toggleDemoMode() {
    const enabled = !store.demoMode;
    store.setDemoMode(enabled);
    if (enabled) {
      const preferredScenario = store.scenarios.find(
        (scenario) =>
          scenario.name.toLowerCase().includes("camp fire")
          || scenario.description.toLowerCase().includes("camp fire"),
      ) ?? store.scenarios[0];
      if (preferredScenario) store.selectScenario(preferredScenario);
    }
  }

  return { fetchLiveWind, runSimulation, cancelSimulation, toggleDemoMode };
}

function buildRequest(store: SimulationStore, wind: WindConditions): SimulationRequest {
  return {
    ignition_lat: store.ignition.lat,
    ignition_lon: store.ignition.lon,
    wind_speed_mph: wind.wind_speed_mph,
    wind_direction_deg: wind.wind_direction_deg,
    wind_gust_mph: wind.wind_gust_mph,
    relative_humidity: wind.relative_humidity,
    num_runs: store.numRuns,
    max_timesteps: store.maxTimesteps,
    scenario_preset: store.selectedScenarioName === "Custom scenario" ? null : store.selectedScenarioName,
  };
}

function validateRequest(request: SimulationRequest) {
  const errors: Record<string, string> = {};
  if (request.ignition_lat < -90 || request.ignition_lat > 90) errors.ignition_lat = "Latitude must be between -90 and 90.";
  if (request.ignition_lon < -180 || request.ignition_lon > 180) errors.ignition_lon = "Longitude must be between -180 and 180.";
  if (request.wind_speed_mph < 0 || request.wind_speed_mph > 100) errors.wind_speed_mph = "Wind speed must be 0 to 100 mph.";
  if (request.wind_direction_deg < 0 || request.wind_direction_deg >= 360) errors.wind_direction_deg = "Direction must be 0 to 359 degrees.";
  if (request.wind_gust_mph < 0 || request.wind_gust_mph > 150) errors.wind_gust_mph = "Gust must be 0 to 150 mph.";
  if (request.relative_humidity < 0 || request.relative_humidity > 100) errors.relative_humidity = "Humidity must be 0 to 100%.";
  if (request.num_runs < 5 || request.num_runs > 15) errors.num_runs = "Monte Carlo runs must be 5 to 15.";
  return errors;
}

function shiftedWind(wind: WindConditions): WindConditions {
  return { ...wind, wind_direction_deg: (wind.wind_direction_deg + 45) % 360 };
}
