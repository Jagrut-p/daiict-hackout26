import React, { useState } from 'react';
import { WasteRouteMap } from './WasteRouteMap';
import { GeneratorLocation, FacilityLocation, WasteRouteDetail } from '../types/gis';
import {
  Route as RouteIcon,
  RotateCcw,
  Sparkles,
  CheckCircle2,
  Leaf,
} from 'lucide-react';

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
    processingEmissionFactor: 0.085, // tCO2e/t
    maxContaminationThreshold: 5,
    acceptedWasteTypes: ['Crop Residue', 'Agricultural Stubble', 'Woody Biomass'],
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
    processingEmissionFactor: 0.092,
    maxContaminationThreshold: 12,
    acceptedWasteTypes: ['Food Waste', 'APMC Wet Waste', 'Slurry'],
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
    processingEmissionFactor: 0.145,
    maxContaminationThreshold: 15,
    acceptedWasteTypes: ['Municipal Organic', 'Horticultural Waste'],
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
  const [activeScenario, setActiveScenario] = useState<'full' | 'empty' | 'generators_only' | 'multistop'>('full');

  // Scenario state derivation
  const currentGenerators =
    activeScenario === 'empty'
      ? []
      : activeScenario === 'generators_only'
      ? SAMPLE_GENERATORS.slice(0, 2)
      : SAMPLE_GENERATORS;

  const currentFacilities =
    activeScenario === 'empty' || activeScenario === 'generators_only' ? [] : SAMPLE_FACILITIES;

  const currentRoutes =
    activeScenario === 'empty' || activeScenario === 'generators_only'
      ? []
      : activeScenario === 'multistop'
      ? [SAMPLE_ROUTES[0]]
      : SAMPLE_ROUTES;

  return (
    <div className="gis-viewer-container space-y-4">
      {/* Test Case Quick Bar */}
      <div className="card p-4 bg-slate-900/90 border border-slate-700/80 rounded-2xl shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
                <Leaf size={18} />
              </span>
              <h3 className="font-bold text-base text-white">GIS Route & Facility Visualizer</h3>
              <span className="version-pill">Leaflet + PostGIS</span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Visualizes waste discovery, multi-stop CVRP collection routes, and carbon-aware facility assignment.
            </p>
          </div>

          {/* Test Case Selector Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-400 font-medium">Test Scenarios:</span>
            
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
              onClick={() => setActiveScenario('multistop')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                activeScenario === 'multistop'
                  ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
              }`}
              title="Test Case 4: Multi-Stop Polyline (Depot -> Gen A -> Gen B -> Facility)"
            >
              <RouteIcon size={13} />
              <span>Test Case 4: Multi-Stop Route</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveScenario('empty')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                activeScenario === 'empty'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
              }`}
              title="Test Case 1: Graceful empty state centering on default city"
            >
              <RotateCcw size={13} />
              <span>Test Case 1: Empty Data</span>
            </button>
          </div>
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
            <CheckCircle2 size={14} /> Test Case 1: Empty Data
          </div>
          <p className="text-slate-400">
            Passes empty arrays without error; auto-centers on default city viewport with 12x zoom.
          </p>
        </div>

        <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800">
          <div className="font-semibold text-emerald-300 flex items-center gap-1.5 mb-1">
            <CheckCircle2 size={14} /> Test Case 2: Generator Popup
          </div>
          <p className="text-slate-400">
            Clicking a green circle displays prominent <strong>Available Waste Volume</strong>, type & contamination.
          </p>
        </div>

        <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800">
          <div className="font-semibold text-blue-300 flex items-center gap-1.5 mb-1">
            <CheckCircle2 size={14} /> Test Case 3: Facility Popup
          </div>
          <p className="text-slate-400">
            Clicking a star marker opens a popup displaying <strong>Remaining Capacity</strong> and tech specs.
          </p>
        </div>

        <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800">
          <div className="font-semibold text-cyan-300 flex items-center gap-1.5 mb-1">
            <CheckCircle2 size={14} /> Test Case 4: Route Overlay
          </div>
          <p className="text-slate-400">
            Polylines smoothly render multi-stop paths connecting Depot → Gen A → Gen B → Destination Facility.
          </p>
        </div>
      </div>
    </div>
  );
};
