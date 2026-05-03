import { useEffect } from "react";
import { useSimulationState } from "../../context/useSimulationState";

export function AnimationTimeline() {
  const { state, dispatch } = useSimulationState();
  const maxTimestep = state.result?.max_timesteps ?? state.maxTimesteps;
  const cutoffMarkers = state.result?.zone_results ?? [];

  useEffect(() => {
    if (!state.animation.playing) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      dispatch({
        type: "animationSet",
        animation: {
          timestep:
            state.animation.timestep >= maxTimestep
              ? 0
              : Math.min(maxTimestep, state.animation.timestep + state.animation.speed),
        },
      });
    }, 1000 / 15);

    return () => window.clearInterval(intervalId);
  }, [dispatch, maxTimestep, state.animation.playing, state.animation.speed, state.animation.timestep]);

  return (
    <div className="timeline" aria-label="Fire spread animation timeline">
      <div className="timeline__controls">
        <button
          className="icon-button"
          type="button"
          aria-label={state.animation.playing ? "Pause animation" : "Play animation"}
          onClick={() =>
            dispatch({
              type: "animationSet",
              animation: { playing: !state.animation.playing },
            })
          }
        >
          {state.animation.playing ? "II" : ">"}
        </button>
        <button
          className="icon-button"
          type="button"
          aria-label="Step backward"
          onClick={() =>
            dispatch({
              type: "animationSet",
              animation: { timestep: Math.max(0, state.animation.timestep - 1) },
            })
          }
        >
          -1
        </button>
        <button
          className="icon-button"
          type="button"
          aria-label="Step forward"
          onClick={() =>
            dispatch({
              type: "animationSet",
              animation: { timestep: Math.min(maxTimestep, state.animation.timestep + 1) },
            })
          }
        >
          +1
        </button>
        <select
          aria-label="Playback speed"
          value={state.animation.speed}
          onChange={(event) =>
            dispatch({
              type: "animationSet",
              animation: { speed: Number(event.target.value) },
            })
          }
        >
          {[0.5, 1, 2, 4].map((speed) => (
            <option key={speed} value={speed}>
              {speed}x
            </option>
          ))}
        </select>
      </div>
      <div className="timeline__range">
        <input
          aria-label="Current fire timestep"
          max={maxTimestep}
          min={0}
          step={1}
          type="range"
          value={state.animation.timestep}
          onChange={(event) =>
            dispatch({
              type: "animationSet",
              animation: { timestep: Number(event.target.value) },
            })
          }
        />
        {cutoffMarkers.map((zone) =>
          zone.cutoff_time ? (
            <span
              className="timeline__marker"
              key={zone.zone_id}
              style={{ left: `${(zone.cutoff_time / maxTimestep) * 100}%` }}
              title={`${zone.zone_id} cutoff at ${zone.cutoff_time} min`}
            />
          ) : null,
        )}
      </div>
      <strong className="timeline__time">t={Math.round(state.animation.timestep)} min</strong>
    </div>
  );
}
