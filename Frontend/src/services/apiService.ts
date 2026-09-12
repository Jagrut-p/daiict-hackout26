import { WasteShipment, SyncApiResponse } from '../types/waste';

export interface BackendHealthResponse {
  status: string;
  system: string;
  version?: string;
  stats?: {
    generators_count: number;
    facilities_count: number;
    shipments_count: number;
    certificates_count: number;
  };
  timestamp?: string;
}

export interface BackendGenerator {
  id: string;
  name: string;
  waste_type: string;
  quantity_tons: number;
  contamination_pct: number;
  lat: number;
  lng: number;
  address?: string;
}

export interface BackendFacility {
  id: string;
  name: string;
  accepted_waste_type: string;
  max_contamination_pct: number;
  processing_factor: number;
  lat: number;
  lng: number;
  capacity_tons_day?: number;
  technology?: string;
  address?: string;
}

export interface FacilityMatchItem {
  facility_id: string;
  facility_name: string;
  distance_km: number;
  transport_emissions_tCO2e: number;
  processing_emissions_tCO2e: number;
  total_emissions_penalty: number;
  net_carbon_benefit_tCO2e: number;
  technology?: string;
  address?: string;
  lat: number;
  lng: number;
}

export interface FacilityMatchResponse {
  generator: BackendGenerator;
  ranked_facilities: FacilityMatchItem[];
  optimal_facility?: FacilityMatchItem;
  evaluated_count: number;
}

export interface BackendShipment {
  shipment_id: string;
  generatorId: string;
  generatorName?: string;
  facilityId?: string;
  facilityName?: string;
  wasteType: string;
  weightKg?: number;
  weightTons?: number;
  contaminationLevel?: number;
  status: string;
  createdAt: string;
  netCarbonImpact?: number;
  receiptId?: string;
  verifiedWeightTons?: number;
}

export interface ScaleVerificationPayload {
  shipmentId: string;
  generatorName?: string;
  wasteType?: string;
  expectedWeightTons?: number;
  actualWeightTons: number;
  deviationPercent?: number;
  hasDiscrepancy?: boolean;
  operatorNotes?: string;
  verifiedAt?: string;
  scaleTerminalId?: string;
}

export interface ScaleVerificationResponse {
  success: boolean;
  status: number;
  message: string;
  receiptId: string;
  timestamp: string;
}

export interface CarbonCertificateResponse {
  certificate_id: string;
  shipment_uuid: string;
  calculation_version_id: string;
  label: string;
  diverted_tons: number;
  avoided_landfill_tCO2e: number;
  displacement_tCO2e: number;
  transport_tCO2e: number;
  processing_tCO2e: number;
  net_climate_benefit_tCO2e: number;
  data_tier: string;
  timestamp: string;
  anti_tamper_hash: string;
  verification_status?: string;
}

export interface EsgAnalyticsResponse {
  summary: {
    total_diverted_tonnes: number;
    total_net_co2e_avoided: number;
    methane_abated_tonnes: number;
    fleet_transport_emissions: number;
    average_reduction_percentage: number;
    active_facilities: number;
    active_generators: number;
    total_shipments_logged: number;
  };
  recent_shipments: BackendShipment[];
  generated_at: string;
}

class ApiService {
  private baseUrl = '';

  /**
   * Check backend connectivity and ping latency
   */
  async checkHealth(): Promise<{ online: boolean; latencyMs: number; data?: BackendHealthResponse }> {
    const start = performance.now();
    try {
      const res = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        headers: { 'Cache-Control': 'no-cache' },
      });
      const latencyMs = Math.round(performance.now() - start);
      if (res.ok) {
        const data: BackendHealthResponse = await res.json();
        return { online: true, latencyMs, data };
      }
      return { online: false, latencyMs, data: undefined };
    } catch {
      const latencyMs = Math.round(performance.now() - start);
      return { online: false, latencyMs, data: undefined };
    }
  }

  /**
   * Fetch all registered generators from backend
   */
  async getGenerators(): Promise<BackendGenerator[]> {
    const res = await fetch(`${this.baseUrl}/generators`);
    if (!res.ok) throw new Error(`Failed to fetch generators (${res.status})`);
    return await res.json();
  }

  /**
   * Register a new generator
   */
  async createGenerator(gen: Partial<BackendGenerator>): Promise<BackendGenerator> {
    const res = await fetch(`${this.baseUrl}/generators`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(gen),
    });
    if (!res.ok) throw new Error(`Failed to create generator (${res.status})`);
    return await res.json();
  }

  /**
   * Fetch all facilities from backend
   */
  async getFacilities(): Promise<BackendFacility[]> {
    const res = await fetch(`${this.baseUrl}/facilities`);
    if (!res.ok) throw new Error(`Failed to fetch facilities (${res.status})`);
    return await res.json();
  }

  /**
   * Register a new facility
   */
  async createFacility(fac: Partial<BackendFacility>): Promise<BackendFacility> {
    const res = await fetch(`${this.baseUrl}/facilities`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fac),
    });
    if (!res.ok) throw new Error(`Failed to create facility (${res.status})`);
    return await res.json();
  }

  /**
   * Run carbon-aware facility matching algorithm on backend
   */
  async matchFacilities(generatorId: string): Promise<FacilityMatchResponse> {
    const res = await fetch(`${this.baseUrl}/facilities/match?generator_id=${encodeURIComponent(generatorId)}`);
    if (!res.ok) throw new Error(`Failed to match facilities for ${generatorId} (${res.status})`);
    return await res.json();
  }

  /**
   * Get all live shipments
   */
  async getShipments(): Promise<BackendShipment[]> {
    const res = await fetch(`${this.baseUrl}/shipments`);
    if (!res.ok) throw new Error(`Failed to fetch shipments (${res.status})`);
    return await res.json();
  }

  /**
   * Sync a waste shipment
   */
  async syncShipment(shipment: WasteShipment): Promise<SyncApiResponse> {
    const res = await fetch(`${this.baseUrl}/shipments/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(shipment),
    });
    return await res.json();
  }

  /**
   * Scale intake terminal verification
   */
  async verifyShipment(payload: ScaleVerificationPayload): Promise<ScaleVerificationResponse> {
    const res = await fetch(`${this.baseUrl}/shipments/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Verification failed (${res.status})`);
    return await res.json();
  }

  /**
   * Calculate MRV Carbon Certificate
   */
  async calculateCarbon(shipmentUuid: string): Promise<CarbonCertificateResponse> {
    const res = await fetch(`${this.baseUrl}/carbon/calculate?shipment_uuid=${encodeURIComponent(shipmentUuid)}`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error(`Failed to calculate carbon MRV (${res.status})`);
    return await res.json();
  }

  /**
   * List all generated carbon certificates
   */
  async getCertificates(): Promise<CarbonCertificateResponse[]> {
    const res = await fetch(`${this.baseUrl}/carbon/certificates`);
    if (!res.ok) throw new Error(`Failed to fetch certificates (${res.status})`);
    return await res.json();
  }

  /**
   * Fetch live ESG Analytics
   */
  async getEsgAnalytics(): Promise<EsgAnalyticsResponse> {
    const res = await fetch(`${this.baseUrl}/carbon/analytics`);
    if (!res.ok) throw new Error(`Failed to fetch ESG analytics (${res.status})`);
    return await res.json();
  }

  /**
   * Reset backend demo database
   */
  async resetDemoData(): Promise<void> {
    await fetch(`${this.baseUrl}/reset-data`, { method: 'POST' });
  }

  /**
   * Optimize multi-stop collection route using Google OR-Tools CVRP
   */
  async optimizeRoute(payload: RouteOptimizationRequest): Promise<RouteOptimizationResponse> {
    const res = await fetch(`${this.baseUrl}/routes/optimize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      let message = `Route optimization failed (${res.status})`;
      try {
        const errorData = await res.json();
        if (errorData?.detail) {
          message = typeof errorData.detail === 'string' ? errorData.detail : JSON.stringify(errorData.detail);
        }
      } catch {
        // Use default message
      }
      throw new Error(message);
    }
    return await res.json();
  }
}

export interface RouteOptimizationRequest {
  depot?: { lat: number; lng: number };
  depot_lat?: number;
  depot_lng?: number;
  generator_ids: string[];
  facility_id: string;
  vehicle_capacity_tons?: number;
}

export interface RouteOptimizationResponse {
  status: string;
  ordered_route: Array<{
    step: string;
    id?: string;
    name: string;
    demand_tons?: number;
    lat?: number;
    lng?: number;
  }>;
  total_distance_km: number;
  total_transport_emissions_tCO2e: number;
  facility?: BackendFacility;
  depot?: { lat: number; lng: number };
}

export const apiService = new ApiService();

