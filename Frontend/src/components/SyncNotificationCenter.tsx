import React, { useState, useEffect, useCallback } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Info,
  X,
  RefreshCw,
  Copy,
  Check,
  Trash2,
  Layers,
  ArrowUpRight,
  Database,
  Sparkles,
} from 'lucide-react';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { getQueuedShipments, clearAllQueued } from '../services/idbStorage';
import { syncService } from '../services/syncService';
import { WasteShipment, NotificationAlert } from '../types/waste';

export type ToastType = 'success' | 'warning' | 'error' | 'info' | 'conflict';

export interface ToastItem {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  durationMs: number;
  timestamp: string;
  shipmentId?: string;
}

const TOAST_EVENT_NAME = 'carbonroute_trigger_toast';

/**
 * Global helper function to trigger a toast from anywhere in the application.
 * TEST CASE 1: Calling triggerToast('success', 'Shipment #4821 Dispatched!') pops up a green alert that auto-dismisses after 3 seconds.
 */
export function triggerToast(
  type: ToastType = 'info',
  message: string,
  durationMs: number = 3000,
  title?: string,
  shipmentId?: string
): void {
  if (typeof window !== 'undefined') {
    const detail: ToastItem = {
      id: crypto.randomUUID(),
      type,
      message,
      title:
        title ||
        (type === 'success'
          ? 'Success'
          : type === 'error'
          ? 'Error'
          : type === 'warning'
          ? 'Warning'
          : type === 'conflict'
          ? 'Conflict Alert'
          : 'Notification'),
      durationMs,
      timestamp: new Date().toISOString(),
      shipmentId,
    };

    window.dispatchEvent(new CustomEvent(TOAST_EVENT_NAME, { detail }));
  }
}

/**
 * React hook to access triggerToast inside components
 */
export function useToast() {
  return {
    triggerToast,
    success: (msg: string, dur?: number, title?: string) =>
      triggerToast('success', msg, dur ?? 3000, title),
    warning: (msg: string, dur?: number, title?: string) =>
      triggerToast('warning', msg, dur ?? 3000, title),
    error: (msg: string, dur?: number, title?: string) =>
      triggerToast('error', msg, dur ?? 4000, title),
    info: (msg: string, dur?: number, title?: string) =>
      triggerToast('info', msg, dur ?? 3000, title),
  };
}

export const SyncNotificationCenter: React.FC = () => {
  const { isOnline, isSimulatedOffline } = useNetworkStatus();
  const [queuedItems, setQueuedItems] = useState<WasteShipment[]>([]);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [copiedUUID, setCopiedUUID] = useState<string | null>(null);

  // Refresh queued shipments list from IndexedDB / LocalStorage
  const refreshQueue = useCallback(async () => {
    try {
      const items = await getQueuedShipments();
      setQueuedItems(items || []);
    } catch (err) {
      console.warn('Error fetching queued shipments:', err);
    }
  }, []);

  // Listen to queue changes, network changes, and sync events
  useEffect(() => {
    refreshQueue();

    const handleQueueUpdated = () => refreshQueue();
    window.addEventListener('waste_queue_updated', handleQueueUpdated);

    // Sync Service Alert Listener
    const unsubscribeSyncAlerts = syncService.onAlert((alert: NotificationAlert) => {
      triggerToast(
        alert.type === 'conflict' ? 'conflict' : alert.type,
        alert.message,
        alert.durationMs || 3500,
        alert.title,
        alert.shipmentId
      );
      refreshQueue();
    });

    // Custom Toast Event Listener
    const handleToastEvent = (e: Event) => {
      const customEvent = e as CustomEvent<ToastItem>;
      if (customEvent.detail) {
        const newToast = customEvent.detail;
        setToasts((prev) => [newToast, ...prev.slice(0, 4)]);

        // TEST CASE 1: Auto-dismiss after duration (default 3000ms)
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== newToast.id));
        }, newToast.durationMs || 3000);
      }
    };

    window.addEventListener(TOAST_EVENT_NAME, handleToastEvent);

    return () => {
      window.removeEventListener('waste_queue_updated', handleQueueUpdated);
      window.removeEventListener(TOAST_EVENT_NAME, handleToastEvent);
      unsubscribeSyncAlerts();
    };
  }, [refreshQueue]);

  // Sync action triggered from the drawer
  const handleForceSync = async () => {
    if (isSyncing || queuedItems.length === 0) return;
    setIsSyncing(true);
    try {
      const res = await syncService.processQueue();
      await refreshQueue();
      triggerToast(
        'success',
        `Processed offline queue: ${res.succeeded} synced successfully.`,
        3000
      );
    } catch {
      triggerToast('error', 'Failed to synchronize offline queue with server.', 3000);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleClearAllQueued = async () => {
    await clearAllQueued();
    await refreshQueue();
    triggerToast('info', 'Local offline queue has been cleared.', 2500);
  };

  const handleCopyUUID = (uuid: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(uuid);
    }
    setCopiedUUID(uuid);
    setTimeout(() => setCopiedUUID((c) => (c === uuid ? null : c)), 2000);
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const queuedCount = queuedItems.length;

  return (
    <>
      {/* 1. STICKY STATUS PILL (Top-Right of screen) */}
      <div className="fixed top-3.5 right-4 sm:top-4 sm:right-6 z-40">
        {/* State 1: Syncing State (Yellow spinner + "Syncing X items...") */}
        {isSyncing ? (
          <button
            type="button"
            onClick={() => setIsDrawerOpen(true)}
            className="flex items-center gap-2.5 px-4 py-2 rounded-xl bg-amber-950/85 border border-amber-500/50 text-amber-300 text-xs font-mono font-bold shadow-lg shadow-amber-500/15 backdrop-blur-md hover:bg-amber-900/85 transition-all cursor-pointer animate-pulse"
            title="Click to view syncing queue details"
          >
            <RefreshCw size={14} className="animate-spin text-amber-400" />
            <span>Syncing {queuedCount} item{queuedCount === 1 ? '' : 's'}...</span>
          </button>
        ) : !isOnline || isSimulatedOffline ? (
          /* State 2: Offline State (Red dot + "Offline (X items queued)") */
          <button
            type="button"
            id="offline-status-pill"
            onClick={() => setIsDrawerOpen(true)}
            // TEST CASE 2: Clicking the "X items queued" pill opens a mini drawer displaying client UUIDs
            className="flex items-center gap-2.5 px-4 py-2 rounded-xl bg-rose-950/85 border border-rose-500/50 text-rose-300 text-xs font-mono font-bold shadow-lg shadow-rose-500/15 backdrop-blur-md hover:bg-rose-900/85 transition-all cursor-pointer"
            title="Click to view offline queued manifest UUIDs in local storage"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
            </span>
            <span>Offline ({queuedCount} item{queuedCount === 1 ? '' : 's'} queued)</span>
          </button>
        ) : (
          /* State 3: Online State (Green dot + "Connected") */
          <button
            type="button"
            id="online-status-pill"
            onClick={() => setIsDrawerOpen(true)}
            className="flex items-center gap-2.5 px-4 py-2 rounded-xl bg-[var(--bg-card)] border border-emerald-400/35 text-emerald-500 dark:text-emerald-300 text-xs font-mono font-medium shadow-lg backdrop-blur-md hover:border-emerald-400/60 transition-all cursor-pointer"
            title={
              queuedCount > 0
                ? `Connected (${queuedCount} offline items ready to sync). Click to inspect.`
                : 'Connected (Direct Sync Online)'
            }
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span>
              Connected {queuedCount > 0 ? `(${queuedCount} queued)` : ''}
            </span>
          </button>
        )}
      </div>

      {/* 2. MINI DRAWER FOR LOCAL STORAGE QUEUED UUIDs (TEST CASE 2) */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/60 backdrop-blur-sm animate-fade-in">
          <div
            className="w-full max-w-md bg-slate-900 border-l border-slate-700/80 shadow-2xl h-full flex flex-col p-5 overflow-hidden animate-slide-in"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                  <Database size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Local Queue Storage</h3>
                  <p className="text-[11px] text-slate-400 font-mono">
                    IndexedDB & LocalStorage Client Manifests
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsDrawerOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
              >
                <X size={18} />
              </button>
            </div>

            {/* Test Helper Trigger Button in Drawer for Test Case 1 Demo */}
            <div className="mt-3 p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-semibold text-slate-300 flex items-center gap-1">
                  <Sparkles size={12} className="text-emerald-400" />
                  Quick Test Trigger:
                </span>
                <span className="text-[10px] text-slate-500 font-mono">Test Case 1</span>
              </div>
              <button
                type="button"
                onClick={() => triggerToast('success', 'Shipment #4821 Dispatched!')}
                className="w-full py-1.5 px-3 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-mono font-bold transition-all text-left flex items-center justify-between"
              >
                <span>triggerToast('success', 'Shipment #4821 Dispatched!')</span>
                <ArrowUpRight size={13} className="shrink-0" />
              </button>
            </div>

            {/* Queued UUIDs List (TEST CASE 2) */}
            <div className="flex-1 overflow-y-auto my-4 space-y-2.5 pr-1">
              {queuedItems.length > 0 ? (
                queuedItems.map((item, index) => {
                  const isCopied = copiedUUID === item.shipment_id;

                  return (
                    <div
                      key={item.shipment_id}
                      className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 space-y-2 hover:border-slate-700 transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono font-bold text-slate-400">
                          #{index + 1} • {item.wasteType} Stream
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                          {(item.weightKg / 1000).toFixed(2)} Tons
                        </span>
                      </div>

                      {/* Client UUID Display with Copy Action */}
                      <div className="flex items-center justify-between gap-2 bg-slate-900 p-2 rounded-lg border border-slate-800 font-mono text-xs">
                        <span className="text-cyan-400 font-semibold truncate" title={item.shipment_id}>
                          {item.shipment_id}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopyUUID(item.shipment_id)}
                          className={`p-1 rounded transition-all shrink-0 ${
                            isCopied
                              ? 'text-emerald-400 bg-emerald-500/20'
                              : 'text-slate-400 hover:text-white bg-slate-800'
                          }`}
                          title="Copy UUID to clipboard"
                        >
                          {isCopied ? <Check size={12} /> : <Copy size={12} />}
                        </button>
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                        <span>Gen: {item.generatorId}</span>
                        <span>{new Date(item.createdAt).toLocaleTimeString()}</span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-12 text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-center mx-auto text-slate-500">
                    <Layers size={22} />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-slate-300">Local Queue Is Empty</h4>
                    <p className="text-xs text-slate-500 max-w-xs mx-auto">
                      All created manifests have been synced directly to the server or no offline
                      records are pending.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Drawer Bottom Actions */}
            <div className="pt-3 border-t border-slate-800 flex gap-2">
              <button
                type="button"
                onClick={handleForceSync}
                disabled={queuedItems.length === 0 || isSyncing}
                className={`flex-1 py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                  queuedItems.length === 0 || isSyncing
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
                    : 'bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white shadow-lg shadow-indigo-500/25'
                }`}
              >
                <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
                <span>Sync Offline Queue ({queuedCount})</span>
              </button>

              {queuedItems.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAllQueued}
                  className="p-2.5 rounded-xl bg-slate-800 hover:bg-rose-950/40 text-slate-400 hover:text-rose-300 border border-slate-700 hover:border-rose-800 transition-all"
                  title="Clear offline queue"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 3. TOAST CONTAINER (Bottom-Right of screen) */}
      <div
        className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none"
        aria-live="polite"
      >
        {toasts.map((toast) => {
          return (
            <div
              key={toast.id}
              className={`pointer-events-auto flex items-start gap-3 p-4 rounded-2xl border shadow-2xl backdrop-blur-xl animate-slide-in transition-all ${
                toast.type === 'success'
                  ? 'bg-slate-950/95 border-emerald-500/80 text-emerald-100 shadow-emerald-500/10'
                  : toast.type === 'error'
                  ? 'bg-slate-950/95 border-rose-500/80 text-rose-100 shadow-rose-500/10'
                  : toast.type === 'warning'
                  ? 'bg-slate-950/95 border-amber-500/80 text-amber-100 shadow-amber-500/10'
                  : toast.type === 'conflict'
                  ? 'bg-slate-950/95 border-rose-600/80 text-rose-100 shadow-rose-500/20'
                  : 'bg-slate-950/95 border-cyan-500/80 text-cyan-100 shadow-cyan-500/10'
              }`}
            >
              {/* Icon */}
              <div className="shrink-0 mt-0.5">
                {toast.type === 'success' && (
                  <div className="p-1 rounded-lg bg-emerald-500/20 text-emerald-400">
                    <CheckCircle2 size={18} />
                  </div>
                )}
                {toast.type === 'error' && (
                  <div className="p-1 rounded-lg bg-rose-500/20 text-rose-400">
                    <AlertTriangle size={18} />
                  </div>
                )}
                {toast.type === 'warning' && (
                  <div className="p-1 rounded-lg bg-amber-500/20 text-amber-400">
                    <AlertTriangle size={18} />
                  </div>
                )}
                {toast.type === 'conflict' && (
                  <div className="p-1 rounded-lg bg-rose-500/20 text-rose-400">
                    <AlertCircle size={18} />
                  </div>
                )}
                {toast.type === 'info' && (
                  <div className="p-1 rounded-lg bg-cyan-500/20 text-cyan-400">
                    <Info size={18} />
                  </div>
                )}
              </div>

              {/* Toast Text Content */}
              <div className="flex-1 min-w-0">
                {toast.title && (
                  <h5 className="text-xs font-bold text-white leading-tight mb-0.5">
                    {toast.title}
                  </h5>
                )}
                <p className="text-xs text-slate-200 leading-relaxed font-sans">
                  {toast.message}
                </p>
                {toast.shipmentId && (
                  <span className="inline-block mt-1 font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-900 text-cyan-400 border border-slate-800">
                    UUID: {toast.shipmentId}
                  </span>
                )}
              </div>

              {/* Close Button */}
              <button
                type="button"
                onClick={() => dismissToast(toast.id)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all shrink-0"
                aria-label="Dismiss notification"
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </>
  );
};
