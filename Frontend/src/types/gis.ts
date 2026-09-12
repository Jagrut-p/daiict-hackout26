export interface GeneratorLocation {
  id: string;
  name?: string;
  lat: number;
  lng: number;
  availableWasteVolume: number; // in tonnes or kg
  volumeUnit?: string; // default: 'tonnes'
  wasteType?: string;
  contaminationLevel?: number; // percentage (0-100)
  qualitySignal?: 'High' | 'Medium' | 'Low' | 'Pending';
  address?: string;
  contact?: string;
}

export interface FacilityLocation {
  id: string;
  name?: string;
  lat: number;
  lng: number;
  remainingCapacity: number; // in tonnes or kg
  capacityUnit?: string; // default: 'tonnes/day'
  totalCapacity?: number;
  technology?: string; // e.g. 'Biochar Pyrolysis', 'Anaerobic Digestion (Biogas)', 'Aerobic Composting'
  processingEmissionFactor?: number; // tCO2e/t
  acceptedWasteTypes?: string[];
  maxContaminationThreshold?: number; // percentage
  address?: string;
}

export type LatLngTuple = [number, number];

export interface WasteRouteDetail {
  id: string;
  name?: string;
  coordinates: LatLngTuple[];
  color?: string;
  vehicleId?: string;
  totalDistanceKm?: number;
  estimatedEmissionsKgCO2e?: number;
  stopsDescription?: string[];
}

// Accepts either raw array of coordinate pairs or full route details
export type RouteInput = LatLngTuple[] | WasteRouteDetail;
