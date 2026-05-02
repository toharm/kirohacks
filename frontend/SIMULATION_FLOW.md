# Simulation Flow Documentation

## Overview

This document describes the complete data flow from the RunButton click through to displaying simulation results.

## Component Architecture

```
RunButton (UI)
    ↓
useSimulation (Hook)
    ↓
SimulationContext (State Management)
    ↓
simulationReducer (Pure Reducer)
    ↓
API Service Layer (Mock/Live)
```

## Detailed Flow

### 1. User Initiates Simulation

**Component:** `RunButton.tsx`

```typescript
// User clicks "Run Simulation" button
handleRun() {
  // Validate inputs
  if (missingIgnition || hasWindErrors) {
    onValidationAttempt?.();
    return;
  }
  
  // Dispatch SUBMIT_SIMULATION action
  startSimulation();
  
  // Call API
  const results = await api.simulate(request, onProgress);
  
  // Set results
  setResults(results);
}
```

### 2. State Transition to Running

**Action:** `SUBMIT_SIMULATION`

**Reducer:** `simulationReducer.ts`

```typescript
case 'SUBMIT_SIMULATION':
  return {
    ...state,
    jobStatus: 'running',
    progress: { completed: 0, total: state.monteCarloRuns },
    error: null,
  };
```

**State Changes:**
- `jobStatus`: `'idle'` → `'running'`
- `progress`: `null` → `{ completed: 0, total: 500 }`
- `error`: cleared

### 3. API Call with Progress Callback

**Service:** `api.ts` → `MockApiClient.ts` or `LiveApiClient.ts`

Both API clients implement the same interface:

```typescript
interface EvacuAIApi {
  simulate(
    request: SimulateRequest,
    onProgress?: ProgressCallback
  ): Promise<SimulationResults>;
}
```

**Mock Client Behavior:**
- Simulates 3-second execution
- Calls `onProgress` every 200ms with updated counts
- Returns mock results matching Pydantic schemas

**Live Client Behavior:**
- POSTs to `/api/simulate` → receives `job_id`
- Polls `/api/results/{job_id}` every 1 second
- Calls `onProgress` on each HTTP 202 response
- Returns complete results on HTTP 200

### 4. Progress Updates

**Action:** `UPDATE_PROGRESS`

**Callback Flow:**
```typescript
api.simulate(request, (progressUpdate) => {
  // progressUpdate: { status: 'running', completed_runs: 342, total_runs: 500 }
  updateProgress(progressUpdate.completed_runs, progressUpdate.total_runs);
});
```

**Reducer:**
```typescript
case 'UPDATE_PROGRESS':
  return {
    ...state,
    progress: action.payload, // { completed: 342, total: 500 }
  };
```

**UI Update:**
- Progress bar width: `(342 / 500) * 100 = 68.4%`
- Button text: `"Running 342/500..."`

### 5. Simulation Completes

**Action:** `SET_RESULTS`

**Reducer:**
```typescript
case 'SET_RESULTS':
  return {
    ...state,
    jobStatus: 'complete',
    currentResults: action.payload,
    progress: null,
    animationTimestep: 0,
    isAnimating: false,
  };
```

**State Changes:**
- `jobStatus`: `'running'` → `'complete'`
- `currentResults`: populated with `SimulationResults`
- `progress`: cleared
- Animation state reset

### 6. Results Rendering

**Components that react to state changes:**

- **MapView**: Renders burn heatmap, routes, zones
- **ResultsPanel**: Displays metrics, comparison, zone table
- **HeaderBar**: Updates status indicator to "Complete ✓"

## Error Handling

### Validation Errors (HTTP 422)

```typescript
catch (err) {
  if (err instanceof ValidationError) {
    // Field-level errors displayed in ControlPanel
    setError(err.message);
  }
}
```

**Action:** `SET_ERROR`

**Reducer:**
```typescript
case 'SET_ERROR':
  return {
    ...state,
    jobStatus: action.payload ? 'error' : state.jobStatus,
    error: action.payload,
    progress: null,
  };
```

### Network Errors

```typescript
catch (err) {
  const message = err instanceof Error 
    ? err.message 
    : 'Simulation failed. Please try again.';
  setError(message);
}
```

**UI Display:**
- Toast notification (red): "Simulation failed. Please try again."
- Button re-enabled for retry

## State Machine

```
┌─────────┐
│  idle   │ ← Initial state
└────┬────┘
     │ SUBMIT_SIMULATION
     ↓
┌─────────┐
│ running │ ← Progress updates via UPDATE_PROGRESS
└────┬────┘
     │
     ├─→ SET_RESULTS → ┌──────────┐
     │                  │ complete │
     │                  └──────────┘
     │
     └─→ SET_ERROR ──→ ┌──────────┐
                        │  error   │
                        └──────────┘
```

## Type Safety

All types are strictly defined and mirror backend Pydantic schemas:

- **Request:** `SimulateRequest`
- **Progress:** `SimulationProgress`
- **Results:** `SimulationResults`
- **Errors:** `ApiValidationError | ApiNetworkError`

TypeScript ensures:
- No runtime type mismatches
- Exhaustive action handling in reducer
- Correct prop types throughout component tree

## Testing Strategy

### Unit Tests (Future)

1. **Reducer Tests:**
   - Each action produces expected state
   - State transitions are pure (no side effects)
   - Invalid actions are handled

2. **Hook Tests:**
   - Dispatch helpers call correct actions
   - Selectors compute correct derived state
   - Memoization prevents unnecessary re-renders

3. **Component Tests:**
   - RunButton disabled states
   - Progress bar width calculation
   - Error message display

### Integration Tests (Future)

1. **Mock API Flow:**
   - Complete simulation with mock data
   - Progress updates received
   - Results displayed correctly

2. **Error Scenarios:**
   - Validation errors show field messages
   - Network errors show toast
   - Retry after error works

## Performance Considerations

1. **Memoization:**
   - All dispatch helpers use `useCallback`
   - Selectors use `useMemo`
   - Prevents unnecessary re-renders

2. **Progress Updates:**
   - Throttled to reasonable intervals (200ms mock, 1s live)
   - Only updates progress state, not full results
   - Minimal re-render impact

3. **API Client Singleton:**
   - Single instance created on first use
   - Reused for all subsequent calls
   - Lazy initialization

## Environment Configuration

```bash
# .env
VITE_API_MODE=mock          # or 'live'
VITE_API_BASE_URL=http://localhost:8000
VITE_MAPBOX_TOKEN=          # optional
```

**Mode Selection:**
- `mock`: Uses `MockApiClient` with local JSON data
- `live`: Uses `LiveApiClient` with real backend

**Switching Modes:**
- Change `.env` file
- Restart dev server
- No code changes required

## Verification Checklist

- [x] RunButton dispatches SUBMIT_SIMULATION
- [x] Reducer transitions to 'running' state
- [x] API client called with correct parameters
- [x] Progress callback updates state via UPDATE_PROGRESS
- [x] Results set via SET_RESULTS action
- [x] Errors handled via SET_ERROR action
- [x] TypeScript build passes with no errors
- [x] State machine follows expected transitions
- [x] All components properly typed
- [x] Documentation complete

## Related Files

- `frontend/src/features/controls/RunButton.tsx` - UI component
- `frontend/src/hooks/useSimulation.ts` - State hook
- `frontend/src/context/SimulationContext.tsx` - Context provider
- `frontend/src/context/simulationReducer.ts` - Pure reducer
- `frontend/src/services/api.ts` - API interface
- `frontend/src/services/mockApiClient.ts` - Mock implementation
- `frontend/src/services/liveApiClient.ts` - Live implementation
- `frontend/src/types/api.ts` - Type definitions
