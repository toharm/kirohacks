/**
 * WindSection Component
 *
 * Control panel section for wind parameters with:
 * - 2×2 grid of labeled numeric inputs (speed, direction, gust, humidity)
 * - Live/Manual toggle using segmented control
 * - "Fetch Live Wind" button that calls api.getWind()
 * - Client-side validation with error display
 *
 * @see requirements.md Requirement 3, AC 2-3, AC 8
 * @see requirements.md Requirement 6, AC 1-4
 */

import { useState, useCallback, useId, useEffect } from "react";
import { useSimulation } from "@/hooks/useSimulation";
import { useShowToast } from "@/context/ToastContext";
import { getApi } from "@/services/api";
import { cn } from "@/lib/cn";

/**
 * Wind mode: 'live' fetches from NWS API, 'manual' allows direct editing
 */
type WindMode = "live" | "manual";

/**
 * Input field configuration
 */
interface WindInputConfig {
  key: "speed" | "direction" | "gust" | "humidity";
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
}

const WIND_INPUTS: WindInputConfig[] = [
  { key: "speed", label: "Speed", unit: "mph", min: 0, max: 100, step: 1 },
  {
    key: "direction",
    label: "Direction",
    unit: "°",
    min: 0,
    max: 360,
    step: 1,
  },
  { key: "gust", label: "Gust", unit: "mph", min: 0, max: 150, step: 1 },
  { key: "humidity", label: "Humidity", unit: "%", min: 0, max: 100, step: 1 },
];

/**
 * Validation error messages keyed by field
 */
export type WindValidationErrors = Partial<
  Record<WindInputConfig["key"], string>
>;

/**
 * Validate a single wind field value against its min/max bounds.
 * Returns an error message string if invalid, or null if valid.
 */
export function validateWindField(
  key: WindInputConfig["key"],
  value: number,
): string | null {
  const config = WIND_INPUTS.find((c) => c.key === key);
  if (!config) return null;

  if (isNaN(value)) {
    return `${config.label} must be a number`;
  }
  if (value < config.min || value > config.max) {
    return `${config.label} must be ${config.min}–${config.max} ${config.unit}`;
  }
  return null;
}

/**
 * Validate all wind fields and return an errors object.
 * Returns an empty object if all fields are valid.
 */
export function validateAllWindFields(params: {
  speed: number;
  direction: number;
  gust: number;
  humidity: number;
}): WindValidationErrors {
  const errors: WindValidationErrors = {};
  for (const input of WIND_INPUTS) {
    const error = validateWindField(input.key, params[input.key]);
    if (error) {
      errors[input.key] = error;
    }
  }
  return errors;
}

interface WindSectionProps {
  /** Called whenever the validation error state changes */
  onValidationChange?: (hasErrors: boolean) => void;
}

/**
 * Wind parameters section for the control panel.
 *
 * Displays a 2×2 grid of numeric inputs for wind speed, direction, gust,
 * and humidity. Includes a segmented control to toggle between Live (NWS)
 * and Manual modes, and a "Fetch Live Wind" button.
 *
 * Validates ranges on blur and on change (clears errors when value is valid).
 */
export function WindSection({
  onValidationChange,
}: WindSectionProps): React.ReactElement {
  const { state, setWind, setWindFromData } = useSimulation();
  const { windParams, ignitionPoint } = state;
  const showToast = useShowToast();

  // Local state for wind mode (live vs manual)
  const [windMode, setWindMode] = useState<WindMode>(
    windParams.source === "manual" ? "manual" : "live",
  );

  // Loading state for fetch operation
  const [isFetching, setIsFetching] = useState(false);

  // Validation error state per field
  const [errors, setErrors] = useState<WindValidationErrors>({});

  // Generate unique IDs for accessibility
  const idPrefix = useId();

  /**
   * Update a single field's error and notify parent of overall error state.
   */
  const updateError = useCallback(
    (key: WindInputConfig["key"], error: string | null) => {
      setErrors((prev) => {
        const next = { ...prev };
        if (error) {
          next[key] = error;
        } else {
          delete next[key];
        }
        // Notify parent after state update
        if (onValidationChange) {
          const hasErrors = Object.keys(next).length > 0;
          onValidationChange(hasErrors);
        }
        return next;
      });
    },
    [onValidationChange],
  );

  /**
   * Handle numeric input change — update context value and clear error if now valid.
   */
  const handleInputChange = useCallback(
    (key: WindInputConfig["key"], value: string) => {
      const numValue = parseFloat(value);
      if (!isNaN(numValue)) {
        setWind({ [key]: numValue, source: "manual" });
        // Clear error immediately if value is now valid
        const error = validateWindField(key, numValue);
        if (!error) {
          updateError(key, null);
        }
      }
    },
    [setWind, updateError],
  );

  /**
   * Handle blur — validate the field and show error if out of range.
   */
  const handleInputBlur = useCallback(
    (key: WindInputConfig["key"], value: string) => {
      const numValue = parseFloat(value);
      const error = validateWindField(key, numValue);
      updateError(key, error);
    },
    [updateError],
  );

  /**
   * Handle wind mode toggle
   */
  const handleModeChange = useCallback(
    (mode: WindMode) => {
      setWindMode(mode);
      if (mode === "manual") {
        setWind({ source: "manual" });
      }
    },
    [setWind],
  );

  /**
   * Handle fetch live wind button click
   * Calls api.getWind() and populates fields with response
   */
  const handleFetchWind = useCallback(async () => {
    if (!ignitionPoint) {
      showToast({
        message: 'Set an ignition point on the map first to fetch live wind.',
        variant: 'warning',
      });
      return;
    }

    setIsFetching(true);

    try {
      const api = await getApi();

      const windData = await api.getWind(ignitionPoint.lat, ignitionPoint.lon);

      // Update wind parameters from API response
      setWindFromData(windData);

      // Clear all validation errors after a successful fetch (values are authoritative)
      setErrors({});
      if (onValidationChange) {
        onValidationChange(false);
      }

      // Set mode to live after successful fetch
      setWindMode("live");

      // Show appropriate toast based on data source
      if (windData.source === "nws") {
        showToast({
          message: `Wind data fetched: ${windData.wind_speed} mph ${getDirectionLabel(windData.wind_direction)}`,
          variant: "success",
        });
      } else if (windData.source === "fallback") {
        showToast({
          message: "Using default wind conditions (NWS unavailable)",
          variant: "warning",
        });
      }
    } catch (error) {
      // Handle fetch error
      console.error("Failed to fetch wind data:", error);

      showToast({
        message: "Failed to fetch wind data. Using current values.",
        variant: "error",
      });
    } finally {
      setIsFetching(false);
    }
  }, [ignitionPoint, setWindFromData, showToast, onValidationChange]);

  // Auto-fetch wind when ignition point is first set and mode is live
  const [autoFetched, setAutoFetched] = useState(false);
  useEffect(() => {
    if (ignitionPoint && !autoFetched && windMode === 'live') {
      setAutoFetched(true);
      handleFetchWind();
    }
    if (!ignitionPoint) setAutoFetched(false);
  }, [ignitionPoint, autoFetched, windMode, handleFetchWind]);

  const isManualMode = windMode === "manual";

  return (
    <section aria-label="Wind Parameters">
      <h3 className="text-xs uppercase tracking-wider text-gray-500 mb-3 font-semibold">
        Wind Parameters
      </h3>

      {/* Live/Manual Segmented Control */}
      <SegmentedControl
        value={windMode}
        onChange={handleModeChange}
        options={[
          { value: "live", label: "Live (NWS)" },
          { value: "manual", label: "Manual" },
        ]}
        className="mb-3"
      />

      {/* 2×2 Grid of Wind Inputs */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        {WIND_INPUTS.map((input) => (
          <WindInput
            key={input.key}
            id={`${idPrefix}-${input.key}`}
            label={input.label}
            unit={input.unit}
            value={windParams[input.key]}
            min={input.min}
            max={input.max}
            step={input.step}
            disabled={!isManualMode}
            error={errors[input.key]}
            onChange={(value) => handleInputChange(input.key, value)}
            onBlur={(value) => handleInputBlur(input.key, value)}
          />
        ))}
      </div>

      {/* Fetch Live Wind Button */}
      <button
        type="button"
        onClick={handleFetchWind}
        disabled={isFetching}
        className={cn(
          "w-full bg-surface-overlay hover:bg-surface-hover",
          "border border-surface-border rounded-md px-3 py-2 text-sm",
          "text-gray-300 transition-colors duration-150",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-primary",
          "min-h-[44px]",
          "flex items-center justify-center gap-2",
          isFetching && "opacity-70 cursor-wait",
        )}
      >
        {isFetching ? (
          <>
            <LoadingSpinner />
            Fetching...
          </>
        ) : (
          <>
            <WindIcon />
            Fetch Live Wind
          </>
        )}
      </button>

      {/* Source indicator */}
      {windParams.source !== "manual" && (
        <p className="text-[10px] text-gray-500 mt-2 text-center">
          Source:{" "}
          {windParams.source === "nws" ? "NWS Forecast" : "Default Values"}
        </p>
      )}
    </section>
  );
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert wind direction degrees to compass label
 */
function getDirectionLabel(degrees: number): string {
  const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const index = Math.round(degrees / 45) % 8;
  return directions[index];
}

// ============================================================================
// Sub-components
// ============================================================================

interface WindInputProps {
  id: string;
  label: string;
  unit: string;
  value: number;
  min: number;
  max: number;
  step: number;
  disabled: boolean;
  error?: string;
  onChange: (value: string) => void;
  onBlur: (value: string) => void;
}

/**
 * Individual wind parameter input with label, unit, and optional error message.
 */
function WindInput({
  id,
  label,
  unit,
  value,
  min,
  max,
  step,
  disabled,
  error,
  onChange,
  onBlur,
}: WindInputProps): React.ReactElement {
  const errorId = `${id}-error`;
  const hasError = Boolean(error);

  return (
    <div>
      <label
        htmlFor={id}
        className="block text-[10px] uppercase tracking-wider text-gray-500 mb-1"
      >
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          aria-invalid={hasError}
          aria-describedby={hasError ? errorId : undefined}
          onChange={(e) => onChange(e.target.value)}
          onBlur={(e) => onBlur(e.target.value)}
          className={cn(
            "w-full bg-surface-base rounded-md",
            "px-3 py-2 pr-10 font-mono text-sm text-gray-200",
            "focus:ring-1 focus:outline-none transition-colors duration-150",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
            hasError
              ? "border border-accent-error focus:border-accent-error focus:ring-accent-error/30"
              : "border border-surface-border focus:border-accent-primary focus:ring-accent-primary/30",
          )}
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500 pointer-events-none">
          {unit}
        </span>
      </div>
      {hasError && (
        <p id={errorId} role="alert" className="mt-1 text-xs text-accent-error">
          {error}
        </p>
      )}
    </div>
  );
}

interface SegmentedControlOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: SegmentedControlOption<T>[];
  className?: string;
}

/**
 * Segmented control for toggling between options
 */
function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  className,
}: SegmentedControlProps<T>): React.ReactElement {
  return (
    <div
      className={cn(
        "flex bg-surface-base border border-surface-border rounded-md p-1",
        className,
      )}
      role="radiogroup"
      aria-label="Wind data source"
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "flex-1 px-3 py-1.5 text-xs font-medium rounded transition-colors duration-150",
            "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent-primary",
            value === option.value
              ? "bg-accent-primary text-white"
              : "text-gray-400 hover:text-gray-200 hover:bg-surface-hover",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Wind icon SVG
 */
function WindIcon(): React.ReactElement {
  return (
    <svg
      className="w-4 h-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M14 5l7 7m0 0l-7 7m7-7H3"
      />
    </svg>
  );
}

/**
 * Loading spinner for fetch state
 */
function LoadingSpinner(): React.ReactElement {
  return (
    <svg
      className="w-4 h-4 animate-spin"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}
