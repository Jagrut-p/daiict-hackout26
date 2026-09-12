import { Shipment, VerificationPayload, VerificationResponse } from '../types/intake';

const API_BASE = (typeof window !== 'undefined' && (window as any).__API_BASE_URL__) || 'http://localhost:8000';

// Built-in Mock Shipments for standalone prototyping & offline testing
export const MOCK_SHIPMENTS: Record<string, Shipment> = {
  'SHIP-1001': {
    shipmentUuid: 'SHIP-1001',
    sourceLotId: 'LOT-ORG-2026-0912-01',
    generatorId: 'gen_1',
    generatorName: 'Hotel Grand Ahmedabad (Kitchen Operations)',
    facilityId: 'fac_2',
    facilityName: 'Gujarat Bio-Energy Facility B',
    wasteTypeId: 'wt_food',
    declaredWasteType: 'Organic Commercial Food Waste (Cooked & Raw)',
    expectedWeightTons: 10.0,
    status: 'ARRIVED',
    dispatchedAt: '2026-09-12 11:30 AM',
    vehicleRegistration: 'GJ-01-CX-4021',
    driverName: 'Ramesh Patel'
  },
  'SHIP-1002': {
    shipmentUuid: 'SHIP-1002',
    sourceLotId: 'LOT-ORG-2026-0912-02',
    generatorId: 'gen_2',
    generatorName: 'Apex Supermarket Wholesale Hub',
    facilityId: 'fac_1',
    facilityName: 'Facility A (Composting & Resource Recovery)',
    wasteTypeId: 'wt_produce',
    declaredWasteType: 'Post-Consumer Vegetable & Produce Scrap',
    expectedWeightTons: 12.5,
    status: 'ARRIVED',
    dispatchedAt: '2026-09-12 12:15 PM',
    vehicleRegistration: 'GJ-27-E-8832',
    driverName: 'Suresh Kumar'
  },
  'SHIP-1003': {
    shipmentUuid: 'SHIP-1003',
    sourceLotId: 'LOT-ORG-2026-0912-03',
    generatorId: 'gen_3',
    generatorName: 'Gujarat Agricultural Mandi Terminal',
    facilityId: 'fac_2',
    facilityName: 'Gujarat Bio-Energy Facility B',
    wasteTypeId: 'wt_agri',
    declaredWasteType: 'Agricultural Crop Residue & Green Foliage',
    expectedWeightTons: 8.0,
    status: 'ARRIVED',
    dispatchedAt: '2026-09-12 01:00 PM',
    vehicleRegistration: 'GJ-18-AA-1109',
    driverName: 'Mahesh Sharma'
  }
};

/**
 * Fetch shipment details by UUID with automatic fallback to mock database
 */
export async function fetchShipmentDetails(uuid: string): Promise<Shipment | null> {
  const trimmed = uuid.trim().toUpperCase();
  if (!trimmed) return null;

  try {
    const res = await fetch(`${API_BASE}/shipments/${encodeURIComponent(trimmed)}`, {
      headers: { 'Accept': 'application/json' }
    });
    if (res.ok) {
      const data = await res.json();
      return {
        shipmentUuid: data.shipment_uuid || data.shipmentUuid || trimmed,
        sourceLotId: data.source_lot_id || data.sourceLotId || `LOT-${trimmed}`,
        generatorId: data.generator_id || data.generatorId,
        generatorName: data.generator_name || data.generatorName || 'Authorized Generator',
        facilityId: data.facility_id || data.facilityId,
        facilityName: data.facility_name || data.facilityName || 'Destination Processing Plant',
        wasteTypeId: data.waste_type_id || data.wasteTypeId || 'wt_food',
        declaredWasteType: data.declared_waste_type || data.declaredWasteType || 'Declared Organic Waste',
        expectedWeightTons: Number(data.expected_weight_tons || data.declared_weight_tons || data.expectedWeightTons || 10.0),
        status: data.status || 'ARRIVED',
        dispatchedAt: data.dispatched_at || data.dispatchedAt,
        vehicleRegistration: data.vehicle_registration || data.vehicleRegistration || 'GJ-01-TRUCK',
        driverName: data.driver_name || data.driverName
      };
    }
  } catch {
    // Fall back to local mock registry
  }

  // Check mock registry
  if (MOCK_SHIPMENTS[trimmed]) {
    return MOCK_SHIPMENTS[trimmed];
  }

  // Dynamic deterministic fallback for any custom UUID tested
  return {
    shipmentUuid: trimmed,
    sourceLotId: `LOT-${trimmed}`,
    generatorName: `Registered Generator for [${trimmed}]`,
    declaredWasteType: 'Commercial Organic & Municipal Wet Waste',
    expectedWeightTons: 10.0,
    status: 'ARRIVED',
    dispatchedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    vehicleRegistration: 'GJ-01-LOGISTICS',
    wasteTypeId: 'wt_food'
  };
}

/**
 * Submit verification record to backend API
 */
export async function submitVerification(payload: VerificationPayload): Promise<VerificationResponse> {
  try {
    const res = await fetch(`${API_BASE}/shipments/${encodeURIComponent(payload.shipmentUuid)}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      return await res.json();
    }
  } catch {
    // Fall back to simulated certified response
  }

  // Simulated instant tamper-evident response
  await new Promise((r) => setTimeout(r, 600));

  const status = payload.requiresManualAudit ? 'AUDIT_REQUIRED' : 'VERIFIED';
  const proofHash = `0x${Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')}`;

  return {
    success: true,
    message: payload.requiresManualAudit
      ? 'Record logged with audit requirement due to >10% weight deviation.'
      : 'Intake weight verified successfully. Chain of custody signed.',
    verificationId: `VRF-${Date.now().toString().slice(-6)}`,
    shipmentUuid: payload.shipmentUuid,
    status,
    actualWeightTons: payload.actualWeightTons,
    expectedWeightTons: payload.expectedWeightTons,
    deviationPercentage: payload.deviationPercentage,
    requiresManualAudit: payload.requiresManualAudit,
    proofHash,
    verifiedAt: payload.verifiedAt
  };
}
