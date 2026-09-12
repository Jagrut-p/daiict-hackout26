import { WasteShipment, SyncApiResponse } from '../types/waste';

export type MockBehaviorMode = 'auto' | 'force_200' | 'force_201' | 'force_409' | 'force_500' | 'network_fail';

class MockServerState {
  private registeredShipmentIds = new Set<string>();
  private conflictSimulatedIds = new Set<string>();
  private currentMode: MockBehaviorMode = 'auto';
  private latencyMs: number = 400;

  constructor() {
    // Seed some duplicate conflict IDs for testing
    this.conflictSimulatedIds.add('CONFLICT-TEST-001');
    this.conflictSimulatedIds.add('duplicate-sample-uuid');
  }

  setMode(mode: MockBehaviorMode) {
    this.currentMode = mode;
  }

  getMode(): MockBehaviorMode {
    return this.currentMode;
  }

  setLatency(ms: number) {
    this.latencyMs = ms;
  }

  getLatency(): number {
    return this.latencyMs;
  }

  addKnownConflictId(id: string) {
    this.conflictSimulatedIds.add(id);
  }

  getRegisteredCount(): number {
    return this.registeredShipmentIds.size;
  }

  getRegisteredIds(): string[] {
    return Array.from(this.registeredShipmentIds);
  }

  clearServerData() {
    this.registeredShipmentIds.clear();
  }

  async processSyncRequest(shipment: WasteShipment): Promise<Response> {
    // Artificial latency for realistic async feel
    if (this.latencyMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.latencyMs));
    }

    const { shipment_id } = shipment;

    // Evaluate response based on simulation mode
    if (this.currentMode === 'network_fail') {
      throw new TypeError('Failed to fetch: NetworkError when attempting to fetch resource.');
    }

    if (this.currentMode === 'force_500') {
      const body: SyncApiResponse = {
        success: false,
        status: 500,
        shipment_id,
        message: 'Internal Server Error: Database write failure (500 Internal Server Error).',
        timestamp: new Date().toISOString(),
      };
      return new Response(JSON.stringify(body), {
        status: 500,
        statusText: 'Internal Server Error',
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (this.currentMode === 'force_409' || this.conflictSimulatedIds.has(shipment_id)) {
      const body: SyncApiResponse = {
        success: false,
        status: 409,
        shipment_id,
        isConflict: true,
        message: `Conflict: Shipment ${shipment_id} was rejected due to a duplicate claim or conflicting manifest (409 Conflict).`,
        timestamp: new Date().toISOString(),
      };
      return new Response(JSON.stringify(body), {
        status: 409,
        statusText: 'Conflict',
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (this.currentMode === 'force_200') {
      this.registeredShipmentIds.add(shipment_id);
      const body: SyncApiResponse = {
        success: true,
        status: 200,
        shipment_id,
        message: `Shipment ${shipment_id} verified and updated idempotently (200 OK).`,
        timestamp: new Date().toISOString(),
      };
      return new Response(JSON.stringify(body), {
        status: 200,
        statusText: 'OK',
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (this.currentMode === 'force_201') {
      this.registeredShipmentIds.add(shipment_id);
      const body: SyncApiResponse = {
        success: true,
        status: 201,
        shipment_id,
        message: `Shipment ${shipment_id} successfully created and registered on server (201 Created).`,
        timestamp: new Date().toISOString(),
      };
      return new Response(JSON.stringify(body), {
        status: 201,
        statusText: 'Created',
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Default 'auto' mode:
    // If already registered, return 200 OK (idempotent success)
    // If new, return 201 Created
    if (this.registeredShipmentIds.has(shipment_id)) {
      const body: SyncApiResponse = {
        success: true,
        status: 200,
        shipment_id,
        message: `Shipment ${shipment_id} already exists; updated state idempotently (200 OK).`,
        timestamp: new Date().toISOString(),
      };
      return new Response(JSON.stringify(body), {
        status: 200,
        statusText: 'OK',
        headers: { 'Content-Type': 'application/json' },
      });
    } else {
      this.registeredShipmentIds.add(shipment_id);
      const body: SyncApiResponse = {
        success: true,
        status: 201,
        shipment_id,
        message: `Shipment ${shipment_id} successfully processed and recorded (201 Created).`,
        timestamp: new Date().toISOString(),
      };
      return new Response(JSON.stringify(body), {
        status: 201,
        statusText: 'Created',
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }
}

export const mockServer = new MockServerState();

/**
 * Installs window.fetch mock interceptor for endpoint '/shipments/sync'
 */
export function setupFetchInterceptor(): void {
  if (typeof window === 'undefined') return;

  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const urlString = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

    if (urlString.includes('/shipments/sync')) {
      try {
        let payload: WasteShipment;
        if (init?.body) {
          payload = typeof init.body === 'string' ? JSON.parse(init.body) : init.body;
        } else {
          payload = {} as WasteShipment;
        }
        return await mockServer.processSyncRequest(payload);
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'TypeError') {
          throw err;
        }
        throw new TypeError('Network connection failed');
      }
    }

    return originalFetch(input, init);
  };
}
