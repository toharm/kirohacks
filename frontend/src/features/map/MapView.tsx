import { useEffect, useState } from "react";
import type { PickingInfo } from "@deck.gl/core";
import DeckGL from "@deck.gl/react";
import { PathLayer, PolygonLayer, ScatterplotLayer, TextLayer } from "@deck.gl/layers";
import { campFirePerimeter, previewZones, shelters } from "../../services/mockData";
import { useSimulationState } from "../../context/useSimulationState";
import type { BurnProbabilityMap, GeoJsonPolygon, RouteResult, Shelter, ZoneResult } from "../../types/api";
import { AnimationTimeline } from "./AnimationTimeline";

interface MapCamera {
  longitude: number;
  latitude: number;
  zoom: number;
  pitch: number;
  bearing: number;
}

interface BurnCell {
  position: [number, number];
  probability: number;
}

interface RouteDatum {
  route: RouteResult;
  selected: boolean;
}

interface ZoneDatum extends ZoneResult {
  selected: boolean;
}

interface HoveredZone {
  zone: ZoneResult;
  x: number;
  y: number;
}

const initialViewState: MapCamera = {
  longitude: -121.6219,
  latitude: 39.7596,
  zoom: 10.9,
  pitch: 48,
  bearing: -18,
};

export function MapView() {
  const { state, dispatch } = useSimulationState();
  const [viewState, setViewState] = useState<MapCamera>(initialViewState);
  const [hoveredZone, setHoveredZone] = useState<HoveredZone | null>(null);
  const zones = state.result?.zone_results ?? previewZones;
  const burnMap = state.result?.burn_probability_map;
  const routes = routeData(zones, state.selectedRouteId);

  useEffect(() => {
    const selectedZone = zones.find((zone) => zone.zone_id === state.selectedZoneId);
    if (!selectedZone) {
      return undefined;
    }
    const center = polygonCenter(selectedZone.geometry);
    const timeoutId = window.setTimeout(() => {
      setViewState((current) => ({
        ...current,
        longitude: center[0],
        latitude: center[1],
        zoom: Math.max(current.zoom, 11.7),
      }));
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [state.selectedZoneId, zones]);

  const layers = [
    state.layers.elevation
      ? new PathLayer({
          id: "terrain-contours",
          data: terrainContours,
          getPath: (path: [number, number][]) => path,
          getColor: [99, 179, 237, 70],
          getWidth: 2 * state.terrainExaggeration,
          widthUnits: "pixels",
        })
      : null,
    state.layers.perimeter
      ? new PolygonLayer<{ geometry: GeoJsonPolygon }>({
          id: "camp-fire-perimeter",
          data: [{ geometry: campFirePerimeter }],
          stroked: true,
          filled: true,
          getPolygon: (item) => item.geometry.coordinates[0],
          getFillColor: [220, 38, 38, 22],
          getLineColor: [255, 107, 53, 210],
          getLineWidth: 3,
          lineWidthUnits: "pixels",
        })
      : null,
    state.layers.zones
      ? new PolygonLayer<ZoneDatum>({
          id: "zone-choropleth-layer",
          data: zones.map((zone) => ({ ...zone, selected: zone.zone_id === state.selectedZoneId })),
          pickable: true,
          stroked: true,
          filled: true,
          getPolygon: (zone) => zone.geometry.coordinates[0],
          getFillColor: (zone) => zoneFillColor(zone),
          getLineColor: (zone) => (zone.selected ? [249, 250, 251, 255] : [148, 163, 184, 130]),
          getLineWidth: (zone) => (zone.selected ? 4 : 1),
          lineWidthUnits: "pixels",
          onHover: (info: PickingInfo<ZoneDatum>) => {
            setHoveredZone(info.object ? { zone: info.object, x: info.x, y: info.y } : null);
          },
          onClick: (info: PickingInfo<ZoneDatum>) => {
            if (info.object) {
              dispatch({ type: "zoneSelected", zoneId: info.object.zone_id });
            }
          },
        })
      : null,
    state.layers.burnHeatmap && burnMap
      ? new ScatterplotLayer<BurnCell>({
          id: "burn-heatmap-layer",
          data: burnCells(burnMap),
          getPosition: (cell) => cell.position,
          getFillColor: (cell) => burnColor(cell.probability, state.burnOpacity),
          getRadius: 440,
          radiusUnits: "meters",
          stroked: false,
          opacity: state.animation.playing ? 0.75 : 1,
        })
      : null,
    state.layers.routes
      ? new PathLayer<RouteDatum>({
          id: "route-overlay-layer",
          data: routes,
          pickable: true,
          getPath: (item) => routePath(item.route),
          getColor: (item) => routeColor(item.route.viability_score ?? 0, item.selected),
          getWidth: (item) => (item.selected ? 8 : 4),
          widthUnits: "pixels",
          onClick: (info: PickingInfo<RouteDatum>) => {
            if (info.object) {
              dispatch({
                type: "routeSelected",
                routeId: info.object.route.route_id,
                zoneId: info.object.route.zone_id,
              });
            }
          },
        })
      : null,
    state.layers.shelters
      ? new ScatterplotLayer<Shelter>({
          id: "shelter-markers",
          data: shelters,
          getPosition: (shelter) => [shelter.lon, shelter.lat],
          getRadius: 260,
          radiusUnits: "meters",
          getFillColor: [16, 185, 129, 225],
          getLineColor: [249, 250, 251, 230],
          getLineWidth: 2,
          lineWidthUnits: "pixels",
          stroked: true,
        })
      : null,
    state.layers.shelters
      ? new TextLayer<Shelter>({
          id: "shelter-labels",
          data: shelters,
          getPosition: (shelter) => [shelter.lon, shelter.lat],
          getText: (shelter) => `${shelter.capacity}`,
          getColor: [249, 250, 251, 255],
          getSize: 12,
          getPixelOffset: [0, -24],
          fontFamily: "JetBrains Mono, monospace",
        })
      : null,
    new ScatterplotLayer({
      id: "ignition-marker",
      data: [state.ignition],
      getPosition: (point) => [point.lon, point.lat],
      getRadius: 300,
      radiusUnits: "meters",
      getFillColor: [255, 107, 53, 210],
      getLineColor: [249, 250, 251, 255],
      getLineWidth: 3,
      lineWidthUnits: "pixels",
      stroked: true,
    }),
  ].filter(Boolean);

  return (
    <main className="map-shell">
      <div className="map-basemap" aria-hidden="true" />
      <DeckGL
        controller
        layers={layers}
        viewState={viewState}
        onClick={(info: PickingInfo) => {
          if (state.selectIgnitionMode && info.coordinate) {
            const [lon, lat] = info.coordinate;
            dispatch({ type: "ignitionSet", lat, lon });
          }
        }}
        onViewStateChange={({ viewState: nextViewState }) =>
          setViewState(toMapCamera(nextViewState as Partial<MapCamera>))
        }
      />

      <div className="map-toolbar">
        <button
          className={`map-chip ${state.selectIgnitionMode ? "is-active" : ""}`}
          type="button"
          onClick={() =>
            dispatch({ type: "selectIgnitionModeSet", enabled: !state.selectIgnitionMode })
          }
        >
          {state.selectIgnitionMode ? "Click map for ignition" : "Ignition select"}
        </button>
        <span className="map-chip">Paradise, CA</span>
        <span className="map-chip">terrain {state.terrainExaggeration.toFixed(1)}x</span>
      </div>

      <button
        className="drawer-tab drawer-tab--left"
        type="button"
        onClick={() => dispatch({ type: "panelSet", panel: "controls", open: !state.panels.controls })}
      >
        Controls
      </button>
      <button
        className="drawer-tab drawer-tab--right"
        type="button"
        onClick={() => dispatch({ type: "panelSet", panel: "results", open: !state.panels.results })}
      >
        Results
      </button>

      {hoveredZone ? <ZoneTooltip hoveredZone={hoveredZone} /> : null}
      <AnimationTimeline />
    </main>
  );
}

function ZoneTooltip({ hoveredZone }: { hoveredZone: HoveredZone }) {
  const { zone, x, y } = hoveredZone;

  return (
    <div className="zone-tooltip" style={{ left: x + 16, top: y + 16 }}>
      <strong>{zone.zone_id}</strong>
      <span>Population {zone.population.toLocaleString()}</span>
      <span>Cutoff {zone.cutoff_time ?? "n/a"} min</span>
      <span>Priority {zone.evacuation_priority_score.toFixed(0)}</span>
      <span>Failure risk {(zone.failure_risk_pct ?? 0).toFixed(0)}%</span>
    </div>
  );
}

function burnCells(map: BurnProbabilityMap): BurnCell[] {
  const { grid_bounds: bounds, data } = map;
  const latStep = (bounds.max_lat - bounds.min_lat) / bounds.grid_rows;
  const lonStep = (bounds.max_lon - bounds.min_lon) / bounds.grid_cols;
  const cells: BurnCell[] = [];

  data.forEach((row, rowIndex) => {
    row.forEach((probability, colIndex) => {
      if (probability < 0.05) {
        return;
      }
      cells.push({
        probability,
        position: [
          bounds.min_lon + lonStep * (colIndex + 0.5),
          bounds.max_lat - latStep * (rowIndex + 0.5),
        ],
      });
    });
  });

  return cells;
}

function burnColor(probability: number, opacity: number): [number, number, number, number] {
  const alpha = Math.round(255 * opacity * Math.min(1, probability + 0.25));
  if (probability < 0.3) {
    return [255, 214, 0, alpha];
  }
  if (probability < 0.6) {
    return [245, 158, 11, alpha];
  }
  if (probability < 0.8) {
    return [255, 107, 53, alpha];
  }
  return [136, 19, 55, alpha];
}

function routeData(zones: ZoneResult[], selectedRouteId: string | null): RouteDatum[] {
  return zones.flatMap((zone) => {
    const items: RouteDatum[] = [
      {
        route: zone.baseline_route,
        selected: zone.baseline_route.route_id === selectedRouteId,
      },
    ];
    if (zone.optimized_route) {
      items.push({
        route: zone.optimized_route,
        selected: zone.optimized_route.route_id === selectedRouteId,
      });
    }
    return items;
  });
}

function routeColor(score: number, selected: boolean): [number, number, number, number] {
  const alpha = selected ? 255 : 190;
  if (score > 80) {
    return [0, 229, 255, alpha];
  }
  if (score >= 50) {
    return [255, 214, 0, alpha];
  }
  return [255, 23, 68, alpha];
}

function routePath(route: RouteResult): [number, number][] {
  return route.path_coords.map(([lat, lon]): [number, number] => [lon, lat]);
}

function toMapCamera(viewState: Partial<MapCamera>): MapCamera {
  return {
    longitude: viewState.longitude ?? initialViewState.longitude,
    latitude: viewState.latitude ?? initialViewState.latitude,
    zoom: viewState.zoom ?? initialViewState.zoom,
    pitch: viewState.pitch ?? initialViewState.pitch,
    bearing: viewState.bearing ?? initialViewState.bearing,
  };
}

function zoneFillColor(zone: ZoneDatum): [number, number, number, number] {
  const cutoff = zone.cutoff_time ?? 99;
  const alpha = zone.selected ? 178 : 112;

  if (cutoff > 30) {
    return [16, 185, 129, alpha];
  }
  if (cutoff > 15) {
    return [255, 214, 0, alpha];
  }
  if (cutoff > 5) {
    return [245, 158, 11, alpha];
  }
  return [239, 68, 68, alpha];
}

function polygonCenter(geometry: GeoJsonPolygon): [number, number] {
  const points = geometry.coordinates[0];
  const total = points.reduce(
    (sum, point) => ({
      lon: sum.lon + point[0],
      lat: sum.lat + point[1],
    }),
    { lat: 0, lon: 0 },
  );

  return [total.lon / points.length, total.lat / points.length];
}

const terrainContours: Array<[number, number][]> = [
  [
    [-121.72, 39.69],
    [-121.68, 39.72],
    [-121.64, 39.77],
    [-121.61, 39.82],
  ],
  [
    [-121.7, 39.71],
    [-121.65, 39.74],
    [-121.59, 39.79],
    [-121.54, 39.83],
  ],
  [
    [-121.69, 39.75],
    [-121.63, 39.77],
    [-121.57, 39.8],
    [-121.5, 39.81],
  ],
  [
    [-121.66, 39.69],
    [-121.62, 39.72],
    [-121.58, 39.76],
    [-121.55, 39.8],
  ],
];
