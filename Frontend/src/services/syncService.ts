import { WasteShipment, SyncApiResponse, SyncAuditLogEntry, NotificationAlert } from '../types/waste';
import { getQueuedShipments, dequeueShipment, updateShipmentStatus } from './idbStorage';

export type SyncEventListener = (entry: SyncAuditLogEntry) => void;
export type AlertListener = (alert: NotificationAlert) => void;

class SyncService {
  private isProcessingQueue = false;
  private auditLogs: SyncAuditLogEntry[] = [];
  private logListeners: Set<SyncEventListener> = new Set();
  private alertListeners: Set<AlertListener> = new Set();

  public onLog(listener: SyncEventListener): () => void {
    this.logListeners.add(listener);
    return () => this.logListeners.delete(listener);
  }

  public onAlert(listener: AlertListener): () => void {
    this.alertListeners.add(listener);
    return () => this.alertListeners.delete(listener);
  }

  public getAuditLogs(): SyncAuditLogEntry[] {
    return [...this.auditLogs];
  }

  public clearAuditLogs(): void {
    this.auditLogs = [];
    this.notifyLogUpdate({
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      shipment_id: 'SYSTEM',
      action: 'sync_start',
      message: 'Audit log cleared',
    });
  }

  private notifyLogUpdate(entry: SyncAuditLogEntry) {
    this.auditLogs.unshift(entry);
    // Keep max 100 entries
    if (this.auditLogs.length > 100) {
      this.auditLogs.pop();
    }
    this.logListeners.forEach((fn) => fn(entry));
  }

  public emitAlert(alert: NotificationAlert) {
    this.alertListeners.forEach((fn) => fn(alert));
  }

  /**
   * Directly sends a single shipment to /shipments/sync.
   * Handles 200, 201, 409, and other error response codes according to requirements.
   */
  public async syncShipment(shipment: WasteShipment): Promise<{
    success: boolean;
    status: number;
    message: string;
    isConflict?: boolean;
  }> {
    const { shipment_id } = shipment;

    this.notifyLogUpdate({
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      shipment_id,
      action: 'sync_start',
      message: `Initiating POST /shipments/sync for ${shipment_id}`,
      payload: shipment,
    });

    try {
      await updateShipmentStatus(shipment_id, 'syncing');

      const response = await fetch('/shipments/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Client-Timestamp': new Date().toISOString(),
          'X-Client-Id': 'eco-sync-client-v1',
        },
        body: JSON.stringify(shipment),
      });

      let responseData: Partial<SyncApiResponse> = {};
      try {
        responseData = await response.json();
      } catch {
        // Response was not JSON
      }

      const statusCode = response.status;
      const statusText = response.statusText;
      const responseMessage =
        responseData.message || `Server returned ${statusCode} ${statusText}`;

      // TEST CASE 3: 200 OK (idempotent success) or 201 Created
      if (statusCode === 200 || statusCode === 201) {
        // Remove item from queue
        await dequeueShipment(shipment_id);

        this.notifyLogUpdate({
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          shipment_id,
          action: 'sync_success',
          statusCode,
          message: responseMessage,
        });

        this.emitAlert({
          id: crypto.randomUUID(),
          type: 'success',
          title: statusCode === 201 ? 'Shipment Registered (201 Created)' : 'Shipment Verified (200 OK)',
          message: responseMessage,
          shipmentId: shipment_id,
          timestamp: new Date().toISOString(),
          durationMs: 5000,
        });

        return {
          success: true,
          status: statusCode,
          message: responseMessage,
        };
      }

      // TEST CASE 4: 409 Conflict (duplicate claim)
      if (statusCode === 409) {
        // Remove from queue so it does not block future syncs
        await dequeueShipment(shipment_id);

        this.notifyLogUpdate({
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          shipment_id,
          action: 'sync_conflict',
          statusCode: 409,
          message: `[409 Conflict] Duplicate claim detected. ${responseMessage}`,
        });

        // Show prominent red alert to the user
        this.emitAlert({
          id: crypto.randomUUID(),
          type: 'conflict',
          title: 'Duplicate Claim Conflict (409 Conflict)',
          message: responseMessage || `Shipment ${shipment_id} has already been claimed or has a duplicate conflict. Removed from offline queue.`,
          shipmentId: shipment_id,
          timestamp: new Date().toISOString(),
          durationMs: 9000,
        });

        return {
          success: false,
          status: 409,
          message: responseMessage,
          isConflict: true,
        };
      }

      // Other HTTP errors (500, 503, 400, etc.)
      await updateShipmentStatus(shipment_id, 'failed', responseMessage, statusCode);

      this.notifyLogUpdate({
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        shipment_id,
        action: 'sync_failed',
        statusCode,
        message: `HTTP ${statusCode} failure: ${responseMessage}`,
      });

      this.emitAlert({
        id: crypto.randomUUID(),
        type: 'error',
        title: `Server Error (${statusCode})`,
        message: `Failed to sync shipment ${shipment_id}: ${responseMessage}. Retained in local queue.`,
        shipmentId: shipment_id,
        timestamp: new Date().toISOString(),
      });

      return {
        success: false,
        status: statusCode,
        message: responseMessage,
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Network request failed';

      await updateShipmentStatus(shipment_id, 'queued', errorMsg);

      this.notifyLogUpdate({
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        shipment_id,
        action: 'sync_failed',
        message: `Network error: ${errorMsg}`,
      });

      return {
        success: false,
        status: 0,
        message: errorMsg,
      };
    }
  }

  /**
   * TEST CASE 2: Network restores -> Component automatically processes the local queue.
   */
  public async processQueue(): Promise<{
    processed: number;
    succeeded: number;
    conflicted: number;
    failed: number;
  }> {
    if (this.isProcessingQueue) {
      return { processed: 0, succeeded: 0, conflicted: 0, failed: 0 };
    }

    this.isProcessingQueue = true;
    let processed = 0;
    let succeeded = 0;
    let conflicted = 0;
    let failed = 0;

    try {
      const queuedItems = await getQueuedShipments();
      if (queuedItems.length === 0) {
        return { processed: 0, succeeded: 0, conflicted: 0, failed: 0 };
      }

      this.notifyLogUpdate({
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        shipment_id: 'QUEUE_PROCESSOR',
        action: 'sync_start',
        message: `Processing local offline queue (${queuedItems.length} items queued)...`,
      });

      // Sort by creation time to process FIFO
      const sorted = [...queuedItems].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );

      for (const shipment of sorted) {
        processed++;
        const result = await this.syncShipment(shipment);

        if (result.success) {
          succeeded++;
        } else if (result.isConflict) {
          conflicted++;
        } else {
          failed++;
        }
      }

      if (processed > 0) {
        this.emitAlert({
          id: crypto.randomUUID(),
          type: failed > 0 ? 'warning' : 'info',
          title: 'Queue Sync Completed',
          message: `Processed ${processed} offline shipments: ${succeeded} synced successfully, ${conflicted} duplicate conflicts resolved, ${failed} pending retries.`,
          timestamp: new Date().toISOString(),
          durationMs: 4000,
        });
      }
    } finally {
      this.isProcessingQueue = false;
    }

    return { processed, succeeded, conflicted, failed };
  }

  public isSyncing(): boolean {
    return this.isProcessingQueue;
  }
}

export const syncService = new SyncService();
