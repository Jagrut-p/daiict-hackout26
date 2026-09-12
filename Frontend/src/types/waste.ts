export type WasteType =
  | 'Organic'
  | 'Recyclable'
  | 'Hazardous'
  | 'E-Waste'
  | 'Industrial'
  | 'Medical'
  | 'Construction';

export interface WasteFormData {
  generatorId: string;
  wasteType: WasteType;
  weightKg: number | '';
  contaminationLevel: number | '';
}

export type ShipmentStatus = 'queued' | 'syncing' | 'synced' | 'conflict' | 'failed';

export interface WasteShipment {
  shipment_id: string; // Local UUIDv4
  generatorId: string;
  wasteType: WasteType;
  weightKg: number;
  contaminationLevel: number;
  createdAt: string;
  status: ShipmentStatus;
  syncAttemptCount: number;
  lastAttemptAt?: string;
  errorDetail?: string;
  statusCode?: number;
}

export interface SyncApiResponse {
  success: boolean;
  status: number;
  shipment_id: string;
  message: string;
  timestamp: string;
  isConflict?: boolean;
}

export interface SyncAuditLogEntry {
  id: string;
  timestamp: string;
  shipment_id: string;
  action: 'submit' | 'queued_offline' | 'sync_start' | 'sync_success' | 'sync_conflict' | 'sync_failed';
  statusCode?: number;
  message: string;
  payload?: Partial<WasteShipment>;
}

export interface NotificationAlert {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'conflict';
  title: string;
  message: string;
  shipmentId?: string;
  timestamp: string;
  durationMs?: number;
}
