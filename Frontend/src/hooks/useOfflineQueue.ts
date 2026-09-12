import { useState, useEffect, useCallback } from 'react';
import { WasteShipment } from '../types/waste';
import { getQueuedShipments, dequeueShipment, clearAllQueued } from '../services/idbStorage';
import { syncService } from '../services/syncService';

export function useOfflineQueue() {
  const [queue, setQueue] = useState<WasteShipment[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  const fetchQueue = useCallback(async () => {
    try {
      const items = await getQueuedShipments();
      setQueue(items);
    } catch (err) {
      console.error('Failed to load queue:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQueue();

    const handleQueueUpdate = () => {
      fetchQueue();
    };

    window.addEventListener('waste_queue_updated', handleQueueUpdate);
    return () => {
      window.removeEventListener('waste_queue_updated', handleQueueUpdate);
    };
  }, [fetchQueue]);

  const removeShipment = useCallback(
    async (shipment_id: string) => {
      await dequeueShipment(shipment_id);
      await fetchQueue();
    },
    [fetchQueue]
  );

  const clearQueue = useCallback(async () => {
    await clearAllQueued();
    await fetchQueue();
  }, [fetchQueue]);

  const syncQueue = useCallback(async () => {
    setIsSyncing(true);
    try {
      const res = await syncService.processQueue();
      await fetchQueue();
      return res;
    } finally {
      setIsSyncing(false);
    }
  }, [fetchQueue]);

  return {
    queue,
    queueCount: queue.length,
    isLoading,
    isSyncing,
    refreshQueue: fetchQueue,
    removeShipment,
    clearQueue,
    syncQueue,
  };
}
