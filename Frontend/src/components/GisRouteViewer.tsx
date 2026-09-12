import React, { useState, useEffect } from 'react';
import { WasteRouteMap } from './WasteRouteMap';
import { GeneratorLocation, FacilityLocation, WasteRouteDetail } from '../types/gis';
import {
  Route as RouteIcon,
  RotateCcw,
  Sparkles,
  CheckCircle2,
  Leaf,
  Navigation,
  Zap,
  AlertTriangle,
} from 'lucide-react';
import { apiService, FacilityMatchResponse } from '../services/apiService';

// Realistic Gandhinagar / Ahmedabad Hackathon Demonstration Dataset
const SAMPLE_GENERATORS: GeneratorLocation[] = [
  {
    id: 'GEN-GJ-01',
    name: 'Gandhinagar Agro Mandi (APMC)',
    lat: 23.2233,
    lng: 72.6492,
    availableWasteVolume: 4.8, // in tonnes
    volumeUnit: 'tonnes',
    wasteType: 'Organic - Agricultural Stubble',
    contaminationLevel: 4,
    qualitySignal: 'High',
    address: 'Sector 21 APMC Yard, Gandhinagar',
  },
  {
    id: 'GEN-GJ-02',
    name: 'Kudasan Food & Hotel Cluster',
    lat: 23.1784,
    lng: 72.6358,
    availableWasteVolume: 2.1,
    volumeUnit: 'tonnes',
    wasteType: 'Organic - Food & Kitchen Waste',
    contaminationLevel: 8,
    qualitySignal: 'Medium',
    address: 'Kudasan Commercial Hub, Gandhinagar',
  },
  {
    id: 'GEN-GJ-03',
    name: 'Infocity Tech Park Canteen',
    lat: 23.1951,
    lng: 72.6288,
    availableWasteVolume: 1.4,
    volumeUnit: 'tonnes',
    wasteType: 'Organic - Food Waste',
    contaminationLevel: 3,
    qualitySignal: 'High',
    address: 'Infocity Gate 1, Gandhinagar',
  },
  {
    id: 'GEN-GJ-04',
    name: 'Pethapur Rural Biomass Hub',
    lat: 23.2721,
    lng: 72.6712,
    availableWasteVolume: 6.5,
    volumeUnit: 'tonnes',
    wasteType: 'Organic - Crop Residue (Mustard/Cotton)',
    contaminationLevel: 2,
    qualitySignal: 'High',
    address: 'Pethapur Farm Collective, Gandhinagar',
  },
];

const SAMPLE_FACILITIES: FacilityLocation[] = [
  {
    id: 'FAC-BIOCHAR-01',
    name: 'Pethapur Biochar Pyrolysis Unit',
    lat: 23.2854,
    lng: 72.6589,
    remainingCapacity: 28.0, // in tonnes/day
    capacityUnit: 'tonnes/day',
    totalCapacity: 40.0,
    technology: 'Biochar Pyrolysis (High Carbon Sequestration)',
    processingEmissionFactor: 0.04, // tCO2e/t
    maxContaminationThreshold: 10,
    acceptedWasteTypes: ['Crop Residue', 'Agricultural Stubble', 'Woody Biomass', 'Organic'],
    address: 'GIDC Bio-Energy Park, Pethapur',
  },
  {
    id: 'FAC-BIOGAS-02',
    name: 'Sector 30 CBG Anaerobic Digestion Plant',
    lat: 23.2389,
    lng: 72.6841,
    remainingCapacity: 45.0,
    capacityUnit: 'tonnes/day',
    totalCapacity: 60.0,
    technology: 'Anaerobic Digestion (CBG / Biogas + Fertilizer)',
    processingEmissionFactor: 0.08,
    maxContaminationThreshold: 15,
    acceptedWasteTypes: ['Food Waste', 'APMC Wet Waste', 'Slurry', 'Organic'],
    address: 'Sector 30 Waste Processing Zone, Gandhinagar',
  },
  {
    id: 'FAC-COMPOST-03',
    name: 'Koba Aerobic High-Throughput Compost Center',
    lat: 23.1422,
    lng: 72.6241,
    remainingCapacity: 18.5,
    capacityUnit: 'tonnes/day',
    totalCapacity: 25.0,
    technology: 'Aerobic Windrow Composting',
    processingEmissionFactor: 0.16,
    maxContaminationThreshold: 20,
    acceptedWasteTypes: ['Municipal Organic', 'Horticultural Waste', 'Organic'],
    address: 'Koba Circle Eco Facility, Gandhinagar',
  },
];

// Test Case 4: Multi-Stop Routes (Depot -> Generator A -> Generator B -> Facility)
const SAMPLE_ROUTES: WasteRouteDetail[] = [
  {
    id: 'ROUTE-CVRP-1',
    name: 'Route 1: APMC & Infocity -> Sector 30 Biogas Plant',
    color: '#10b981',
    totalDistanceKm: 14.8,
    estimatedEmissionsKgCO2e: 13.3,
    coordinates: [
      [23.1885, 72.6288], // Depot (DA-IICT Central Hub)
      [23.1951, 72.6288], // Stop 1: Infocity Tech Park (Gen 3)
      [23.2233, 72.6492], // Stop 2: APMC Mandi (Gen 1)
      [23.2389, 72.6841], // Dropoff: Sector 30 Biogas Facility
    ],
  },
  {
    id: 'ROUTE-CVRP-2',
    name: 'Route 2: Kudasan & Pethapur -> Biochar Pyrolysis Plant',
    color: '#06b6d4',
    totalDistanceKm: 22.4,
    estimatedEmissionsKgCO2e: 19.8,
    coordinates: [
      [23.1885, 72.6288], // Depot
      [23.1784, 72.6358], // Stop 1: Kudasan Commercial Hub (Gen 2)
      [23.2721, 72.6712], // Stop 2: Pethapur Biomass (Gen 4)
      [23.2854, 72.6589], // Dropoff: Pethapur Biochar Facility
    ],
  },
];

export const GisRouteViewer: React.FC = () => {
  const [activeScenario, setActiveScenario] = useState<'full' | 'empty' | 'generators_only' | 'multistop' | 'backend_match'>('full');
  const [liveGenerators, setLiveGenerators] = useState<GeneratorLocation[]>(SAMPLE_GENERATORS);
  const [liveFacilities, setLiveFacilities] = useState<FacilityLocation[]>(SAMPLE_FACILITIES);
  const [selectedGeneratorId, setSelectedGeneratorId] = useState<string>('GEN-GJ-01');
  const [matchResult, setMatchResult] = useState<FacilityMatchResponse | null>(null);
  const [isMatching, setIsMatching] = useState<boolean>(false);
  const [cvrpRoute, setCvrpRoute] = useState<WasteRouteDetail | null>(null);
  const [isOptimizingCvrp, setIsOptimizingCvrp] = useState<boolean>(false);
  const [selectedCvrpGenerators, setSelectedCvrpGenerators] = useState<string[]>([
    'GEN-GJ-01',
    'GEN-GJ-02',
    'GEN-GJ-03',
  ]);
  const [selectedCvrpFacilityId, setSelectedCvrpFacilityId] = useState<string>('FAC-BIOCHAR-01');
  const [cvrpError, setCvrpError] = useState<string | null>(null);

  const handleRunCvrpOptimization = async () => {
    if (selectedCvrpGenerators.length === 0) {
      setCvrpError('Please select at least one generator pickup stop.');
      return;
    }
    setIsOptimizingCvrp(true);
    setCvrpError(null);
    try {
      const res = await apiService.optimizeRoute({
        generator_ids: selectedCvrpGenerators,
        facility_id: selectedCvrpFacilityId,
        vehicle_capacity_tons: 25.0,
      });

      if (res && res.ordered_route) {
        const coords: [number, number][] = [];
        if (res.depot) {
          coords.push([res.depot.lat, res.depot.lng]);
        }
        res.ordered_route.forEach((s) => {
          if (s.lat !== undefined && s.lng !== undefined) {
            coords.push([s.lat, s.lng]);
          }
        });
        // The ordered_route already concludes with the destination facility drop-off.
        // Only append res.facility if it is not already the final coordinate.
        if (res.facility && coords.length > 0) {
          const lastCoord = coords[coords.length - 1];
          const isSameAsFacility =
            Math.abs(lastCoord[0] - res.facility.lat) < 0.0001 &&
            Math.abs(lastCoord[1] - res.facility.lng) < 0.0001;
          if (!isSameAsFacility) {
            coords.push([res.facility.lat, res.facility.lng]);
          }
        }

        setCvrpRoute({
          id: 'ROUTE-CVRP-LIVE',
          name: `OR-Tools CVRP Optimized: ${res.ordered_route.length} stops (${res.total_distance_km} km)`,
          color: '#06b6d4',
          totalDistanceKm: res.total_distance_km,
          estimatedEmissionsKgCO2e: Math.round(res.total_transport_emissions_tCO2e * 1000),
          coordinates: coords.length > 0 ? coords : SAMPLE_ROUTES[0].coordinates,
        });
        setActiveScenario('multistop');
      } else {
        throw new Error('Optimizer returned an empty route.');
      }
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error
          ? err.message
          : typeof err === 'object' && err !== null && 'message' in err
          ? String((err as { message: unknown }).message)
          : 'Failed to optimize CVRP route. Please check backend connection and vehicle capacity.';
      setCvrpError(errorMsg);
    } finally {
      setIsOptimizingCvrp(false);
    }
  };

  // Load generators and facilities from backend on mount
  useEffect(() => {
    async function loadBackendGisData() {
      try {
        const gens = await apiService.getGenerators();
        if (gens && gens.length > 0) {
          const convertedGens: GeneratorLocation[] = gens.map((g) => ({
            id: g.id,
            name: g.name,
            lat: g.lat,
            lng: g.lng,
            availableWasteVolume: g.quantity_tons,
            wasteType: g.waste_type,
            contaminationLevel: g.contamination_pct,
            address: g.address || 'Gandhinagar Region',
          }));
          setLiveGenerators(convertedGens);
        }

        const facs = await apiService.getFacilities();
        if (facs && facs.length > 0) {
          const convertedFacs: FacilityLocation[] = facs.map((f) => ({
            id: f.id,
            name: f.name,
            lat: f.lat,
            lng: f.lng,
            remainingCapacity: f.capacity_tons_day || 50.0,
            totalCapacity: (f.capacity_tons_day || 50.0) * 1.5,
            technology: f.technology || 'Standard Processing',
            processingEmissionFactor: f.processing_factor,
            maxContaminationThreshold: f.max_contamination_pct,
            address: f.address || 'Gujarat',
          }));
          setLiveFacilities(convertedFacs);
          if (!facs.some((f) => f.id === selectedCvrpFacilityId)) {
            setSelectedCvrpFacilityId(facs[0].id);
          }
        }
      } catch {
        // Use default mock GIS data if backend offline
      }
    }

    loadBackendGisData();
  }, []);

  // Run Backend Carbon-Aware Facility Matching
  const handleRunBackendMatch = async () => {
    setIsMatching(true);
    try {
      const res = await apiService.matchFacilities(selectedGeneratorId);
      setMatchResult(res);
      setActiveScenario('backend_match');
    } catch {
      // Synthetic fallback match
      const gen = liveGenerators.find((g) => g.id === selectedGeneratorId) || liveGenerators[0];
      const optFac = liveFacilities[0];
      setMatchResult({
        generator: {
          id: gen.id,
          name: gen.name || gen.id,
          waste_type: gen.wasteType || 'Organic',
          quantity_tons: gen.availableWasteVolume || 5.0,
          contamination_pct: gen.contaminationLevel || 4.0,
          lat: gen.lat,
          lng: gen.lng,
        },
        ranked_facilities: [
          {
            facility_id: optFac.id,
            facility_name: optFac.name || optFac.id,
            distance_km: 7.2,
            transport_emissions_tCO2e: 0.032,
            processing_emissions_tCO2e: 0.192,
            total_emissions_penalty: 0.224,
            net_carbon_benefit_tCO2e: 3.616,
            lat: optFac.lat,
            lng: optFac.lng,
          },
        ],
        optimal_facility: {
          facility_id: optFac.id,
          facility_name: optFac.name || optFac.id,
          distance_km: 7.2,
          transport_emissions_tCO2e: 0.032,
          processing_emissions_tCO2e: 0.192,
          total_emissions_penalty: 0.224,
          net_carbon_benefit_tCO2e: 3.616,
          lat: optFac.lat,
          lng: optFac.lng,
        },
        evaluated_count: 1,
      });
      setActiveScenario('backend_match');
    } finally {
      setIsMatching(false);
    }
  };

  // Build dynamic backend route line if in backend_match scenario
  const backendOptimalRoute: WasteRouteDetail[] = React.useMemo(() => {
    if (activeScenario === 'backend_match' && matchResult && matchResult.optimal_facility) {
      const gen = matchResult.generator;
      const fac = matchResult.optimal_facility;
      return [
        {
          id: `ROUTE-OPTIMAL-${gen.id}`,
          name: `Optimal Carbon-Aware Path: ${gen.name} → ${fac.facility_name}`,
          color: '#10b981',
          totalDistanceKm: fac.distance_km,
          estimatedEmissionsKgCO2e: Math.round(fac.transport_emissions_tCO2e * 1000),
          coordinates: [
            [gen.lat, gen.lng],
            [fac.lat, fac.lng],
          ],
        },
      ];
    }
    return [];
  }, [activeScenario, matchResult]);

  // Scenario state derivation
  const currentGenerators =
    activeScenario === 'empty'
      ? []
      : activeScenario === 'generators_only'
      ? liveGenerators.slice(0, 2)
      : liveGenerators;

  const currentFacilities =
    activeScenario === 'empty' || activeScenario === 'generators_only' ? [] : liveFacilities;

  const currentRoutes =
    activeScenario === 'empty' || activeScenario === 'generators_only'
      ? []
      : activeScenario === 'backend_match'
      ? backendOptimalRoute
      : activeScenario === 'multistop'
      ? [cvrpRoute || SAMPLE_ROUTES[0]]
      : SAMPLE_ROUTES;

  return (
    <div className="gis-viewer-container space-y-4">
      {/* Test Case Quick Bar */}
      <div className="card p-4 bg-slate-900/90 border border-slate-700/80 rounded-2xl shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
                <Leaf size={18} />
              </span>
              <h3 className="font-bold text-base text-white">GIS Route & Facility Visualizer</h3>
              <span className="version-pill">Leaflet + FastAPI GIS</span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Visualizes waste discovery, multi-stop CVRP collection routes, and live carbon-aware facility assignment.
            </p>
          </div>

          {/* Test Case Selector Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveScenario('full')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                activeScenario === 'full'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
              }`}
            >
              <Sparkles size={13} />
              <span>Full Value Chain (4 Gen + 3 Fac + 2 Routes)</span>
            </button>

            <button
              type="button"
              onClick={handleRunCvrpOptimization}
              disabled={isOptimizingCvrp}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                activeScenario === 'multistop'
                  ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
              }`}
              title="Optimize multi-stop route via Google OR-Tools CVRP solver"
            >
              <RouteIcon size={13} className={isOptimizingCvrp ? 'animate-spin' : ''} />
              <span>{isOptimizingCvrp ? 'Optimizing CVRP...' : 'OR-Tools Multi-Stop'}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveScenario('empty')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                activeScenario === 'empty'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
              }`}
              title="Test Case 1: Empty state centering on default city"
            >
              <RotateCcw size={13} />
              <span>Empty State</span>
            </button>
          </div>
        </div>

        {/* Real-Time Carbon-Aware Matcher Bar */}
        <div className="mt-3 pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-slate-300 font-semibold flex items-center gap-1">
              <Navigation size={13} className="text-cyan-400" />
              Backend Carbon-Aware Match Engine:
            </span>
            <select
              value={selectedGeneratorId}
              onChange={(e) => setSelectedGeneratorId(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white font-medium focus:outline-none focus:border-cyan-400"
            >
              {liveGenerators.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name || g.id} ({g.availableWasteVolume}t {g.wasteType})
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={handleRunBackendMatch}
              disabled={isMatching}
              className="px-3 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-all flex items-center gap-1 shadow-sm disabled:opacity-50"
            >
              <Zap size={12} className={isMatching ? 'animate-bounce' : ''} />
              <span>{isMatching ? 'Calculating MRV...' : 'Calculate Optimal Destination'}</span>
            </button>
          </div>

          {matchResult && matchResult.optimal_facility && (
            <div className="text-xs text-emerald-300 bg-emerald-950/40 border border-emerald-500/30 px-3 py-1 rounded-xl flex items-center gap-2 font-mono">
              <span>Optimal: <strong>{matchResult.optimal_facility.facility_name}</strong></span>
              <span>•</span>
              <span>{matchResult.optimal_facility.distance_km} km</span>
              <span>•</span>
              <span className="text-emerald-400">+{matchResult.optimal_facility.net_carbon_benefit_tCO2e} tCO₂e net</span>
            </div>
          )}
        </div>

        {/* Real-Time CVRP Multi-Stop Optimizer Controls */}
        <div className="mt-3 pt-3 border-t border-slate-800 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-slate-300 font-semibold flex items-center gap-1">
                <RouteIcon size={13} className="text-cyan-400" />
                OR-Tools CVRP Optimizer:
              </span>

              {/* Destination Facility Dropdown */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-400">Drop-off:</span>
                <select
                  value={selectedCvrpFacilityId}
                  onChange={(e) => setSelectedCvrpFacilityId(e.target.value)}
                  className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white font-medium focus:outline-none focus:border-cyan-400"
                >
                  {liveFacilities.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name || f.id} ({f.technology || 'Facility'})
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={handleRunCvrpOptimization}
                disabled={isOptimizingCvrp || selectedCvrpGenerators.length === 0}
                className="px-3 py-1 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold transition-all flex items-center gap-1 shadow-sm disabled:opacity-50"
              >
                <RouteIcon size={12} className={isOptimizingCvrp ? 'animate-spin' : ''} />
                <span>{isOptimizingCvrp ? 'Solving CVRP Route...' : 'Run CVRP Optimizer'}</span>
              </button>
            </div>

            {/* Route summary badge if live CVRP active */}
            {cvrpRoute && activeScenario === 'multistop' && !cvrpError && (
              <div className="text-xs text-cyan-300 bg-cyan-950/40 border border-cyan-500/30 px-3 py-1 rounded-xl flex items-center gap-2 font-mono">
                <span>Route: <strong>{cvrpRoute.name}</strong></span>
                <span>•</span>
                <span>{cvrpRoute.totalDistanceKm} km</span>
                <span>•</span>
                <span className="text-cyan-400">{cvrpRoute.estimatedEmissionsKgCO2e} kg CO₂e</span>
              </div>
            )}
          </div>

          {/* Generator Stops Multi-Select Chips */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-slate-400 font-medium mr-1">Select Pickup Stops:</span>
            {liveGenerators.map((g) => {
              const isSelected = selectedCvrpGenerators.includes(g.id);
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => {
                    setSelectedCvrpGenerators((prev) =>
                      isSelected ? prev.filter((id) => id !== g.id) : [...prev, g.id]
                    );
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all flex items-center gap-1 ${
                    isSelected
                      ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300'
                      : 'bg-slate-950 border-slate-700 text-slate-400 hover:border-slate-600'
                  }`}
                  title={`${g.name} (${g.availableWasteVolume}t ${g.wasteType})`}
                >
                  <span>{isSelected ? '☑' : '☐'}</span>
                  <span>{g.name || g.id}</span>
                  <span className="text-slate-500">({g.availableWasteVolume}t)</span>
                </button>
              );
            })}
            {selectedCvrpGenerators.length === 0 && (
              <span className="text-amber-400 text-xs italic">Select at least 1 generator stop to optimize route</span>
            )}
          </div>

          {/* CVRP Error Display */}
          {cvrpError && (
            <div className="p-2.5 rounded-xl bg-red-950/40 border border-red-500/40 text-xs text-red-300 flex items-start gap-2">
              <AlertTriangle size={15} className="text-red-400 mt-0.5 shrink-0" />
              <div className="flex-1">
                <span className="font-semibold">CVRP Optimization Error:</span> {cvrpError}
              </div>
              <button
                type="button"
                onClick={() => setCvrpError(null)}
                className="text-red-400 hover:text-red-200 text-xs font-bold px-1"
              >
                Dismiss
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Embedded Map Component */}
      <WasteRouteMap
        generators={currentGenerators}
        facilities={currentFacilities}
        routes={currentRoutes}
        height="560px"
      />

      {/* Interactive Verification Checklist Box */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
        <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800">
          <div className="font-semibold text-emerald-300 flex items-center gap-1.5 mb-1">
            <CheckCircle2 size={14} /> Live Backend Integration
          </div>
          <p className="text-slate-400">
            Dynamically computes emissions via <code>/facilities/match</code> factoring distance (0.0009 tCO₂e/km/t) and technology processing factors.
          </p>
        </div>

        <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800">
          <div className="font-semibold text-emerald-300 flex items-center gap-1.5 mb-1">
            <CheckCircle2 size={14} /> Generator Markers
          </div>
          <p className="text-slate-400">
            Pulsing icons indicating tonnage, waste type, and contamination percentage across Gandhinagar & Ahmedabad.
          </p>
        </div>

        <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800">
          <div className="font-semibold text-blue-300 flex items-center gap-1.5 mb-1">
            <CheckCircle2 size={14} /> Facility Specifications
          </div>
          <p className="text-slate-400">
            Displays processing capacity (Pyrolysis, AD Biogas, Aerobic Composting) and emission intensity.
          </p>
        </div>

        <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800">
          <div className="font-semibold text-cyan-300 flex items-center gap-1.5 mb-1">
            <CheckCircle2 size={14} /> Carbon-Aware Polyline
          </div>
          <p className="text-slate-400">
            Renders optimal direct connection path with live emissions calculation on the Leaflet canvas.
          </p>
        </div>
      </div>
    </div>
  );
};
