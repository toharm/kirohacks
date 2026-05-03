import { apiClient, ApiRequestError, ApiValidationError } from "../services/api";
import { useSimulationState } from "../context/useSimulationState";
import { useToasts } from "../context/useToasts";
import type { SimulationRequest, WindConditions } from "../types/api";

export function useSimulation() {
  const { state, dispatch } = useSimulationState();
  const { pushToast } = useToasts();

  async function fetchLiveWind() {
    dispatch({ type: "windModeSet", mode: "live" });

    try {
      const response = await apiClient.fetchWind(state.ignition.lat, state.ignition.lon);
      dispatch({ type: "windSet", wind: response.conditions, modified: false });
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
    const wind = options.quickCompare ? shiftedWind(state.wind) : state.wind;
    const request = buildRequest(state, wind);
    const errors = validateRequest(request);

    if (Object.keys(errors).length > 0) {
      dispatch({ type: "fieldErrorsSet", errors });
      pushToast({
        tone: "warning",
        title: "Check simulation inputs",
        message: "One or more values are outside the accepted range.",
      });
      return;
    }

    if (options.quickCompare) {
      dispatch({ type: "windSet", wind, modified: true });
    }

    dispatch({ type: "runStarted", previousResult: options.quickCompare ? state.result : null });

    try {
      const result = await apiClient.runSimulation(request, (progress) => {
        dispatch({ type: "runProgressed", progress });
      });

      dispatch({
        type: "runCompleted",
        result,
        modifiedWind: state.modifiedWind || options.quickCompare === true,
      });
      pushToast({
        tone: "success",
        title: "Simulation complete",
        message: `${result.summary.runs_completed} Monte Carlo runs aggregated.`,
      });
    } catch (error) {
      if (error instanceof ApiValidationError) {
        const fieldErrors = Object.fromEntries(
          error.issues.map((issue) => [issue.field, issue.message]),
        );
        dispatch({ type: "fieldErrorsSet", errors: fieldErrors });
        pushToast({
          tone: "warning",
          title: "Backend validation failed",
          message: "The API rejected one or more fields.",
        });
        return;
      }

      const message = error instanceof ApiRequestError || error instanceof Error
        ? error.message
        : "Simulation request failed.";
      dispatch({ type: "runFailed", message });
      pushToast({ tone: "critical", title: "Simulation failed", message });
    }
  }

  return { fetchLiveWind, runSimulation };
}

function buildRequest(
  state: ReturnType<typeof useSimulationState>["state"],
  wind: WindConditions,
): SimulationRequest {
  return {
    ignition_lat: state.ignition.lat,
    ignition_lon: state.ignition.lon,
    wind_speed_mph: wind.wind_speed_mph,
    wind_direction_deg: wind.wind_direction_deg,
    wind_gust_mph: wind.wind_gust_mph,
    relative_humidity: wind.relative_humidity,
    num_runs: state.numRuns,
    max_timesteps: state.maxTimesteps,
    scenario_preset: state.selectedScenarioName === "Custom scenario" ? null : state.selectedScenarioName,
    region: "paradise-ca",
  };
}

function validateRequest(request: SimulationRequest) {
  const errors: Record<string, string> = {};

  if (request.ignition_lat < -90 || request.ignition_lat > 90) {
    errors.ignition_lat = "Latitude must be between -90 and 90.";
  }
  if (request.ignition_lon < -180 || request.ignition_lon > 180) {
    errors.ignition_lon = "Longitude must be between -180 and 180.";
  }
  if (request.wind_speed_mph < 0 || request.wind_speed_mph > 100) {
    errors.wind_speed_mph = "Wind speed must be 0 to 100 mph.";
  }
  if (request.wind_direction_deg < 0 || request.wind_direction_deg >= 360) {
    errors.wind_direction_deg = "Direction must be 0 to 359 degrees.";
  }
  if (request.wind_gust_mph < 0 || request.wind_gust_mph > 150) {
    errors.wind_gust_mph = "Gust must be 0 to 150 mph.";
  }
  if (request.relative_humidity < 0 || request.relative_humidity > 100) {
    errors.relative_humidity = "Humidity must be 0 to 100%.";
  }
  if (request.num_runs < 50 || request.num_runs > 1000) {
    errors.num_runs = "Monte Carlo runs must be 50 to 1000.";
  }

  return errors;
}

function shiftedWind(wind: WindConditions): WindConditions {
  return {
    ...wind,
    wind_direction_deg: (wind.wind_direction_deg + 45) % 360,
  };
}
