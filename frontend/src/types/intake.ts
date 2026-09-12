export interface Shipment {
  shipmentUuid: string;
  sourceLotId?: string;
  generatorId?: string;
  generatorName: string;
  facilityId?: string;
  facilityName?: string;
  wasteTypeId: string;
  declaredWasteType: string;
  expectedWeightTons: number;
  status: 'PENDING' | 'IN_TRANSIT' | 'ARRIVED' | 'VERIFIED' | 'AUDIT_REQUIRED' | 'FLAGGED';
  dispatchedAt?: string;
  vehicleRegistration?: string;
  driverName?: string;
}

export interface VerificationPayload {
  shipmentUuid: string;
  expectedWeightTons: number;
  actualWeightTons: number;
  deviationPercentage: number;
  weightDifferenceTons: number;
  requiresManualAudit: boolean;
  operatorNotes?: string;
  operatorId?: string;
  weighStationId?: string;
  verifiedAt: string;
}

export interface VerificationResponse {
  success: boolean;
  message: string;
  verificationId: string;
  shipmentUuid: string;
  status: 'VERIFIED' | 'AUDIT_REQUIRED';
  actualWeightTons: number;
  expectedWeightTons: number;
  deviationPercentage: number;
  requiresManualAudit: boolean;
  proofHash?: string;
  verifiedAt: string;
}

export interface FacilityIntakeTerminalProps {
  /** Optional custom shipment fetcher */
  onFetchShipment?: (uuid: string) => Promise<Shipment | null>;
  /** Optional custom verification submit handler */
  onVerify?: (payload: VerificationPayload) => Promise<VerificationResponse>;
  /** Default station identifier */
  stationId?: string;
  /** Default operator identifier */
  operatorId?: string;
  /** Initial shipment UUID to load */
  initialShipmentUuid?: string;
}
