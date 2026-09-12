import React, { useEffect, useMemo, useState } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  Tooltip,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import {
  GeneratorLocation,
  FacilityLocation,
  RouteInput,
  WasteRouteDetail,
  LatLngTuple,
} from '../types/gis';
import {
  Factory,
  MapPin,
  Route as RouteIcon,
  Maximize2,
  Minimize2,
  Trash2,
  Compass,
} from 'lucide-react';

export interface WasteRouteMapProps {
  /** Array of waste generators with coordinates, waste volumes, and metadata */
  generators?: GeneratorLocation[];
  /** Array of conversion facilities with coordinates, capacity, and tech specifications */
  facilities?: FacilityLocation[];
  /** Array of route coordinate arrays or route detail objects */
  routes?: RouteInput[];
  /** Optional custom default center [lat, lng] if no data exists (Default: DA-IICT / Gandhinagar [23.1885, 72.6288]) */
  defaultCenter?: LatLngTuple;
  /** Optional default zoom level */
  defaultZoom?: number;
  /** Optional container height */
  height?: string;
  /** Optional className for custom layout wrapping */
  className?: string;
}

// Default fallback coordinate (Gandhinagar / Ahmedabad region)
const FALLBACK_CENTER: LatLngTuple = [23.1885, 72.6288];
const FALLBACK_ZOOM = 12;

/**
 * Helper component to automatically adjust map viewport to fit all active markers and routes
 */
const MapAutoBounds: React.FC<{
  bounds: LatLngTuple[];
  defaultCenter: LatLngTuple;
  defaultZoom: number;
}> = ({ bounds, defaultCenter, defaultZoom }) => {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    if (bounds.length === 0) {
      map.setView(defaultCenter, defaultZoom);
    } else if (bounds.length === 1) {
      map.setView(bounds[0], Math.max(map.getZoom(), 13));
    } else {
      try {
        const leafletBounds = L.latLngBounds(bounds);
        if (leafletBounds.isValid()) {
          map.fitBounds(leafletBounds, { padding: [45, 45], maxZoom: 15 });
        }
      } catch {
        map.setView(defaultCenter, defaultZoom);
      }
    }
  }, [map, bounds, defaultCenter, defaultZoom]);

  return null;
};

/**
 * Creates custom SVG DivIcon for Generator markers (Small vibrant circle with pulsing radar effect)
 */
const createGeneratorIcon = (generator: GeneratorLocation): L.DivIcon => {
  const isHighVolume = (generator.availableWasteVolume || 0) > 2.0;
  const color = isHighVolume ? '#f59e0b' : '#10b981'; // Amber if high volume, Emerald if standard

  const html = `
    <div class="custom-gis-marker generator-marker-wrapper" title="${generator.name || generator.id}">
      <div class="marker-pulse" style="background-color: ${color}40;"></div>
      <div class="marker-pin generator-pin" style="background: linear-gradient(135deg, ${color}, #047857); border-color: #ffffff; box-shadow: 0 0 12px ${color}80;">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <path d="m4.93 4.93 4.24 4.24"></path>
          <path d="m14.83 9.17 4.24-4.24"></path>
          <path d="m14.83 14.83 4.24 4.24"></path>
          <path d="m9.17 14.83-4.24 4.24"></path>
        </svg>
      </div>
      <span class="marker-label generator-badge">${(generator.availableWasteVolume || 0).toFixed(1)}t</span>
    </div>
  `;

  return L.divIcon({
    className: 'custom-leaflet-div-icon',
    html,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -18],
  });
};

/**
 * Creates custom SVG DivIcon for Facility markers (Distinct large star badge with industrial emblem)
 */
const createFacilityIcon = (facility: FacilityLocation): L.DivIcon => {
  const tech = facility.technology?.toLowerCase() || '';
  let color = '#3b82f6'; // Blue default
  if (tech.includes('biochar') || tech.includes('pyrolysis')) color = '#8b5cf6'; // Violet for Biochar
  else if (tech.includes('biogas') || tech.includes('anaerobic')) color = '#06b6d4'; // Cyan for Biogas
  else if (tech.includes('compost')) color = '#10b981'; // Green for Compost

  const html = `
    <div class="custom-gis-marker facility-marker-wrapper" title="${facility.name || facility.id}">
      <div class="marker-star-badge" style="background: linear-gradient(135deg, ${color}, #1e3a8a); box-shadow: 0 0 16px ${color}90;">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="#fbbf24" stroke="#d97706" stroke-width="1.5">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
        </svg>
      </div>
      <div class="facility-status-dot"></div>
      <span class="marker-label facility-badge">${(facility.remainingCapacity || 0).toFixed(0)}t/d</span>
    </div>
  `;

  return L.divIcon({
    className: 'custom-leaflet-div-icon',
    html,
    iconSize: [42, 42],
    iconAnchor: [21, 21],
    popupAnchor: [0, -22],
  });
};

export const WasteRouteMap: React.FC<WasteRouteMapProps> = ({
  generators = [],
  facilities = [],
  routes = [],
  defaultCenter = FALLBACK_CENTER,
  defaultZoom = FALLBACK_ZOOM,
  height = '580px',
  className = '',
}) => {
  // Layer toggles
  const [showGenerators, setShowGenerators] = useState(true);
  const [showFacilities, setShowFacilities] = useState(true);
  const [showRoutes, setShowRoutes] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Normalize route inputs (support both raw LatLngTuple[] or full WasteRouteDetail objects)
  const normalizedRoutes = useMemo(() => {
    return (routes || []).map((route, idx): WasteRouteDetail => {
      if (Array.isArray(route)) {
        return {
          id: `route-${idx + 1}`,
          name: `Optimized Route #${idx + 1}`,
          coordinates: route,
          color: idx % 2 === 0 ? '#10b981' : '#38bdf8',
        };
      }
      return {
        ...route,
        id: route.id || `route-${idx + 1}`,
        name: route.name || `Optimized Route #${idx + 1}`,
        color: route.color || (idx % 2 === 0 ? '#10b981' : '#38bdf8'),
      };
    });
  }, [routes]);

  // Aggregate all valid coordinates to calculate optimal map viewport bounds
  const allCoordinates = useMemo<LatLngTuple[]>(() => {
    const coords: LatLngTuple[] = [];

    if (showGenerators) {
      generators.forEach((g) => {
        if (typeof g.lat === 'number' && typeof g.lng === 'number' && !isNaN(g.lat) && !isNaN(g.lng)) {
          coords.push([g.lat, g.lng]);
        }
      });
    }

    if (showFacilities) {
      facilities.forEach((f) => {
        if (typeof f.lat === 'number' && typeof f.lng === 'number' && !isNaN(f.lat) && !isNaN(f.lng)) {
          coords.push([f.lat, f.lng]);
        }
      });
    }

    if (showRoutes) {
      normalizedRoutes.forEach((r) => {
        r.coordinates.forEach((pt) => {
          if (Array.isArray(pt) && pt.length === 2 && !isNaN(pt[0]) && !isNaN(pt[1])) {
            coords.push([pt[0], pt[1]]);
          }
        });
      });
    }

    return coords;
  }, [generators, facilities, normalizedRoutes, showGenerators, showFacilities, showRoutes]);

  // Summary Metrics
  const totalAvailableWaste = useMemo(() => {
    return generators.reduce((acc, g) => acc + (g.availableWasteVolume || 0), 0);
  }, [generators]);

  const totalRemainingCapacity = useMemo(() => {
    return facilities.reduce((acc, f) => acc + (f.remainingCapacity || 0), 0);
  }, [facilities]);

  return (
    <div
      className={`waste-route-gis-container relative rounded-2xl overflow-hidden border border-slate-700/80 bg-slate-900 shadow-2xl transition-all duration-300 ${
        isFullscreen ? 'fixed inset-4 z-50 h-[calc(100vh-2rem)]' : ''
      } ${className}`}
      style={{ height: isFullscreen ? 'auto' : height }}
    >
      {/* Top Floating Glass Toolbar & KPI Metrics */}
      <div className="absolute top-3 left-3 right-3 z-[1000] pointer-events-none flex flex-wrap items-center justify-between gap-2">
        {/* Left Summary Badge */}
        <div className="pointer-events-auto flex items-center gap-2 bg-slate-900/85 backdrop-blur-md px-3.5 py-2 rounded-xl border border-slate-700/80 shadow-lg text-xs">
          <div className="flex items-center gap-1.5 font-semibold text-slate-200">
            <Compass size={16} className="text-emerald-400 animate-spin-slow" />
            <span>GIS Route Intelligence</span>
          </div>

          <div className="h-4 w-px bg-slate-700 mx-1" />

          <div className="flex items-center gap-3 text-slate-300">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <strong className="text-white">{generators.length}</strong> Generators
              <span className="text-slate-400">({totalAvailableWaste.toFixed(1)}t avail)</span>
            </span>

            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-blue-400"></span>
              <strong className="text-white">{facilities.length}</strong> Facilities
              <span className="text-slate-400">({totalRemainingCapacity.toFixed(0)}t cap)</span>
            </span>

            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
              <strong className="text-white">{normalizedRoutes.length}</strong> Active Routes
            </span>
          </div>
        </div>

        {/* Right Action & Layer Toggles */}
        <div className="pointer-events-auto flex items-center gap-1.5 bg-slate-900/85 backdrop-blur-md p-1 rounded-xl border border-slate-700/80 shadow-lg text-xs">
          <button
            type="button"
            onClick={() => setShowGenerators(!showGenerators)}
            className={`px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-all font-medium ${
              showGenerators
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Toggle Generator Markers"
          >
            <MapPin size={14} />
            <span>Generators</span>
          </button>

          <button
            type="button"
            onClick={() => setShowFacilities(!showFacilities)}
            className={`px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-all font-medium ${
              showFacilities
                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Toggle Facility Markers"
          >
            <Factory size={14} />
            <span>Facilities</span>
          </button>

          <button
            type="button"
            onClick={() => setShowRoutes(!showRoutes)}
            className={`px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-all font-medium ${
              showRoutes
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Toggle Route Polylines"
          >
            <RouteIcon size={14} />
            <span>Routes</span>
          </button>

          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Map'}
          >
            {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </button>
        </div>
      </div>

      {/* Main Leaflet Map Viewport */}
      <MapContainer
        center={defaultCenter}
        zoom={defaultZoom}
        scrollWheelZoom={true}
        className="w-full h-full z-0 leaflet-dark-mode"
        attributionControl={false}
      >
        {/* Dark Modern CartoDB Map Tiles */}
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          maxZoom={19}
        />

        {/* Dynamic Bounds Adjuster */}
        <MapAutoBounds
          bounds={allCoordinates}
          defaultCenter={defaultCenter}
          defaultZoom={defaultZoom}
        />

        {/* --- 1. RENDER ROUTE POLYLINES (Multi-Stop Paths) --- */}
        {showRoutes &&
          normalizedRoutes.map((route, routeIdx) => {
            if (!route.coordinates || route.coordinates.length < 2) return null;

            return (
              <React.Fragment key={route.id || `route-layer-${routeIdx}`}>
                {/* Glowing Outer Polyline */}
                <Polyline
                  positions={route.coordinates}
                  pathOptions={{
                    color: route.color || '#10b981',
                    weight: 6,
                    opacity: 0.35,
                    lineCap: 'round',
                    lineJoin: 'round',
                  }}
                />

                {/* Solid Core Path */}
                <Polyline
                  positions={route.coordinates}
                  pathOptions={{
                    color: route.color || '#10b981',
                    weight: 3.5,
                    opacity: 0.95,
                    dashArray: '6, 8',
                    lineCap: 'round',
                    lineJoin: 'round',
                  }}
                >
                  <Tooltip sticky direction="top" className="custom-gis-tooltip">
                    <div className="font-semibold text-slate-100">{route.name}</div>
                    <div className="text-xs text-slate-300">
                      Stops: {route.coordinates.length} waypoints
                      {route.totalDistanceKm && ` • ${route.totalDistanceKm} km`}
                      {route.estimatedEmissionsKgCO2e && ` • ${route.estimatedEmissionsKgCO2e} kg CO₂e`}
                    </div>
                  </Tooltip>
                </Polyline>
              </React.Fragment>
            );
          })}

        {/* --- 2. RENDER GENERATOR MARKERS (Small Vibrant Circles) --- */}
        {showGenerators &&
          generators.map((gen) => {
            if (typeof gen.lat !== 'number' || typeof gen.lng !== 'number') return null;

            return (
              <Marker
                key={gen.id}
                position={[gen.lat, gen.lng]}
                icon={createGeneratorIcon(gen)}
              >
                <Popup className="custom-gis-popup" minWidth={260} maxWidth={320}>
                  <div className="gis-popup-content p-3 bg-slate-900 text-slate-100 rounded-xl border border-slate-700/80 shadow-xl">
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
                      <div className="flex items-center gap-2">
                        <span className="p-1 rounded-md bg-emerald-500/20 text-emerald-400">
                          <Trash2 size={15} />
                        </span>
                        <div>
                          <h4 className="font-bold text-sm text-white leading-tight">
                            {gen.name || gen.id}
                          </h4>
                          <span className="text-[10px] text-slate-400 uppercase tracking-wider font-mono">
                            ID: {gen.id}
                          </span>
                        </div>
                      </div>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800/60">
                        Generator
                      </span>
                    </div>

                    {/* Available Waste Volume Callout (Test Case 2 Requirement) */}
                    <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-lg p-2.5 mb-2.5 text-center">
                      <span className="text-[11px] text-emerald-300 block font-medium">
                        Available Waste Volume
                      </span>
                      <strong className="text-xl font-extrabold text-emerald-400 tracking-tight">
                        {gen.availableWasteVolume !== undefined
                          ? `${gen.availableWasteVolume} ${gen.volumeUnit || 'tonnes'}`
                          : 'Not Specified'}
                      </strong>
                    </div>

                    {/* Secondary Attributes */}
                    <div className="space-y-1.5 text-xs text-slate-300">
                      {gen.wasteType && (
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400">Waste Type:</span>
                          <span className="font-semibold text-slate-200">{gen.wasteType}</span>
                        </div>
                      )}

                      {gen.contaminationLevel !== undefined && (
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400">Contamination:</span>
                          <span
                            className={`font-semibold ${
                              gen.contaminationLevel > 15 ? 'text-amber-400' : 'text-emerald-400'
                            }`}
                          >
                            {gen.contaminationLevel}%
                          </span>
                        </div>
                      )}

                      {gen.qualitySignal && (
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400">Quality Signal:</span>
                          <span className="font-medium text-slate-200">{gen.qualitySignal}</span>
                        </div>
                      )}

                      {gen.address && (
                        <div className="pt-1 text-[11px] text-slate-400 border-t border-slate-800/80">
                          📍 {gen.address}
                        </div>
                      )}
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })}

        {/* --- 3. RENDER FACILITY MARKERS (Large Star Badges) --- */}
        {showFacilities &&
          facilities.map((fac) => {
            if (typeof fac.lat !== 'number' || typeof fac.lng !== 'number') return null;

            return (
              <Marker
                key={fac.id}
                position={[fac.lat, fac.lng]}
                icon={createFacilityIcon(fac)}
              >
                <Popup className="custom-gis-popup" minWidth={270} maxWidth={340}>
                  <div className="gis-popup-content p-3 bg-slate-900 text-slate-100 rounded-xl border border-slate-700/80 shadow-xl">
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
                      <div className="flex items-center gap-2">
                        <span className="p-1 rounded-md bg-blue-500/20 text-blue-400">
                          <Factory size={15} />
                        </span>
                        <div>
                          <h4 className="font-bold text-sm text-white leading-tight">
                            {fac.name || fac.id}
                          </h4>
                          <span className="text-[10px] text-slate-400 uppercase tracking-wider font-mono">
                            Facility: {fac.id}
                          </span>
                        </div>
                      </div>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-950 text-blue-300 border border-blue-800/60">
                        Conversion Hub
                      </span>
                    </div>

                    {/* Remaining Capacity Callout (Test Case 3 Requirement) */}
                    <div className="bg-blue-950/40 border border-blue-500/30 rounded-lg p-2.5 mb-2.5 text-center">
                      <span className="text-[11px] text-blue-300 block font-medium">
                        Remaining Capacity
                      </span>
                      <strong className="text-xl font-extrabold text-blue-400 tracking-tight">
                        {fac.remainingCapacity !== undefined
                          ? `${fac.remainingCapacity} ${fac.capacityUnit || 'tonnes/day'}`
                          : 'Not Specified'}
                      </strong>
                    </div>

                    {/* Secondary Attributes */}
                    <div className="space-y-1.5 text-xs text-slate-300">
                      {fac.technology && (
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400">Technology:</span>
                          <span className="font-semibold text-purple-300">{fac.technology}</span>
                        </div>
                      )}

                      {fac.processingEmissionFactor !== undefined && (
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400">Processing Factor:</span>
                          <span className="font-mono text-slate-200">
                            {fac.processingEmissionFactor} tCO₂e/t
                          </span>
                        </div>
                      )}

                      {fac.maxContaminationThreshold !== undefined && (
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400">Max Contamination:</span>
                          <span className="font-semibold text-slate-200">
                            ≤ {fac.maxContaminationThreshold}%
                          </span>
                        </div>
                      )}

                      {fac.address && (
                        <div className="pt-1 text-[11px] text-slate-400 border-t border-slate-800/80">
                          📍 {fac.address}
                        </div>
                      )}
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })}
      </MapContainer>

      {/* Bottom Map Legend */}
      <div className="absolute bottom-3 left-3 z-[1000] pointer-events-none">
        <div className="pointer-events-auto flex items-center gap-3 bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-800 text-[11px] text-slate-300 shadow-md">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block"></span>
            <span>Generator (Available Volume)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-yellow-400 font-bold">★</span>
            <span>Facility (Remaining Capacity)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-4 h-0.5 bg-emerald-400 inline-block border-t border-dashed border-emerald-300"></span>
            <span>Optimized Path</span>
          </div>
        </div>
      </div>
    </div>
  );
};
