import { WasteShipment } from '../types/waste';

const DB_NAME = 'WasteCollectionDB';
const DB_VERSION = 1;
const STORE_NAME = 'shipments_queue';
const LOCAL_STORAGE_KEY = 'eco_waste_shipments_queue';

/**
 * Generates an RFC4122 version 4 compliant UUID.
 * Uses native Web Crypto API with fallback.
 */
export function generateUUIDv4(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback for environments where crypto.randomUUID is not available
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function notifyQueueChange() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('waste_queue_updated'));
  }
}

// Check if IndexedDB is available
const isIndexedDBSupported = (): boolean => {
  return typeof window !== 'undefined' && 'indexedDB' in window && window.indexedDB !== null;
};

// Open or initialize IndexedDB connection
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!isIndexedDBSupported()) {
      reject(new Error('IndexedDB not supported'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'shipment_id' });
        store.createIndex('createdAt', 'createdAt', { unique: false });
        store.createIndex('status', 'status', { unique: false });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error || new Error('Failed to open IndexedDB'));
    };
  });
}

// LocalStorage Fallback Handlers
function getLocalStorageQueue(): WasteShipment[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error('Error reading localStorage queue:', err);
    return [];
  }
}

function saveLocalStorageQueue(queue: WasteShipment[]): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(queue));
    notifyQueueChange();
  } catch (err) {
    console.error('Error writing to localStorage queue:', err);
  }
}

/**
 * Retrieve all shipments currently stored in the offline queue.
 */
export async function getQueuedShipments(): Promise<WasteShipment[]> {
  if (!isIndexedDBSupported()) {
    return getLocalStorageQueue();
  }

  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        resolve((request.result as WasteShipment[]) || []);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  } catch (err) {
    console.warn('Falling back to localStorage for getQueuedShipments:', err);
    return getLocalStorageQueue();
  }
}

/**
 * Add or update a shipment in the offline queue.
 */
export async function enqueueShipment(shipment: WasteShipment): Promise<void> {
  if (!isIndexedDBSupported()) {
    const queue = getLocalStorageQueue();
    const existingIndex = queue.findIndex((s) => s.shipment_id === shipment.shipment_id);
    if (existingIndex >= 0) {
      queue[existingIndex] = shipment;
    } else {
      queue.push(shipment);
    }
    saveLocalStorageQueue(queue);
    return;
  }

  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(shipment);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(request.error);
      };

      transaction.oncomplete = () => {
        notifyQueueChange();
      };
    });
  } catch (err) {
    console.warn('Falling back to localStorage for enqueueShipment:', err);
    const queue = getLocalStorageQueue();
    const existingIndex = queue.findIndex((s) => s.shipment_id === shipment.shipment_id);
    if (existingIndex >= 0) {
      queue[existingIndex] = shipment;
    } else {
      queue.push(shipment);
    }
    saveLocalStorageQueue(queue);
  }
}

/**
 * Remove a shipment from the queue by its shipment_id.
 */
export async function dequeueShipment(shipment_id: string): Promise<void> {
  if (!isIndexedDBSupported()) {
    const queue = getLocalStorageQueue();
    const filtered = queue.filter((s) => s.shipment_id !== shipment_id);
    saveLocalStorageQueue(filtered);
    return;
  }

  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(shipment_id);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(request.error);
      };

      transaction.oncomplete = () => {
        notifyQueueChange();
      };
    });
  } catch (err) {
    console.warn('Falling back to localStorage for dequeueShipment:', err);
    const queue = getLocalStorageQueue();
    const filtered = queue.filter((s) => s.shipment_id !== shipment_id);
    saveLocalStorageQueue(filtered);
  }
}

/**
 * Update the status of a specific shipment in the queue.
 */
export async function updateShipmentStatus(
  shipment_id: string,
  status: WasteShipment['status'],
  errorDetail?: string,
  statusCode?: number
): Promise<void> {
  const shipments = await getQueuedShipments();
  const target = shipments.find((s) => s.shipment_id === shipment_id);
  if (target) {
    target.status = status;
    target.lastAttemptAt = new Date().toISOString();
    target.syncAttemptCount = (target.syncAttemptCount || 0) + 1;
    if (errorDetail !== undefined) target.errorDetail = errorDetail;
    if (statusCode !== undefined) target.statusCode = statusCode;
    await enqueueShipment(target);
  }
}

/**
 * Clear all items from the offline queue.
 */
export async function clearAllQueued(): Promise<void> {
  if (!isIndexedDBSupported()) {
    saveLocalStorageQueue([]);
    return;
  }

  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
      transaction.oncomplete = () => notifyQueueChange();
    });
  } catch (err) {
    saveLocalStorageQueue([]);
  }
}
