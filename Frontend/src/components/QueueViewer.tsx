import React from 'react';
import { useOfflineQueue } from '../hooks/useOfflineQueue';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import {
  Database,
  RefreshCw,
  Trash2,
  CheckCircle,
  Clock,
  AlertTriangle,
  XCircle,
  Scale,
  Building2,
  Flame,
} from 'lucide-react';

export const QueueViewer: React.FC = () => {
  const { queue, queueCount, isLoading, isSyncing, removeShipment, clearQueue, syncQueue } =
    useOfflineQueue();
  const { isOnline } = useNetworkStatus();

  return (
    <div className="card queue-container">
      <div className="queue-header">
        <div className="queue-title-group">
          <div className="queue-icon-badge">
            <Database size={20} className="text-cyan-400" />
          </div>
          <div>
            <h3 className="card-title text-base font-bold">Local Offline Storage Queue (IndexedDB)</h3>
            <p className="text-xs text-slate-400">
              Pending shipments queued in browser storage awaiting sync to <code>/shipments/sync</code>
            </p>
          </div>
        </div>

        <div className="queue-actions">
          <span className="queue-count-badge">
            {queueCount} {queueCount === 1 ? 'Item' : 'Items'} Queued
          </span>

          <button
            type="button"
            id="manual-sync-queue-btn"
            onClick={() => syncQueue()}
            disabled={queueCount === 0 || isSyncing || !isOnline}
            className="btn-action btn-action-sync focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:outline-none"
            aria-label="Process and sync all offline queued shipments now"
            title={!isOnline ? 'Cannot sync while offline' : 'Process all queued shipments now'}
          >
            <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
            <span>{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
          </button>

          <button
            type="button"
            onClick={() => clearQueue()}
            disabled={queueCount === 0 || isSyncing}
            className="btn-action btn-action-clear focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:outline-none"
            aria-label="Clear all offline queued shipments"
            title="Clear all stored items"
          >
            <Trash2 size={14} />
            <span>Clear</span>
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="queue-loading">
          <RefreshCw size={20} className="animate-spin text-cyan-400" />
          <span>Loading stored shipments...</span>
        </div>
      ) : queueCount === 0 ? (
        <div className="queue-empty">
          <div className="empty-icon-wrap">
            <CheckCircle size={32} className="text-emerald-400" />
          </div>
          <p className="empty-title">Offline Queue is Clean & Synced</p>
          <p className="empty-desc">
            All shipments have been processed or no offline data is waiting. Submit a manifest while offline to see it buffered here.
          </p>
        </div>
      ) : (
        <div className="queue-list">
          {queue.map((item) => (
            <div key={item.shipment_id} className={`queue-card queue-card-${item.status}`}>
              <div className="queue-card-top">
                <div className="queue-id-block">
                  <span className="queue-id-label">shipment_id (UUIDv4)</span>
                  <code className="queue-id-val font-mono">{item.shipment_id}</code>
                </div>

                <div className="queue-status-tag">
                  {item.status === 'queued' && (
                    <span className="tag-queued">
                      <Clock size={12} /> Queued
                    </span>
                  )}
                  {item.status === 'syncing' && (
                    <span className="tag-syncing">
                      <RefreshCw size={12} className="animate-spin" /> Syncing
                    </span>
                  )}
                  {item.status === 'failed' && (
                    <span className="tag-failed">
                      <AlertTriangle size={12} /> Retry Pending ({item.statusCode || 'Err'})
                    </span>
                  )}
                  {item.status === 'conflict' && (
                    <span className="tag-conflict">
                      <XCircle size={12} /> Conflict 409
                    </span>
                  )}
                </div>
              </div>

              <div className="queue-details-grid">
                <div className="queue-detail-item">
                  <Building2 size={14} className="text-slate-400" />
                  <span className="text-slate-300 font-mono text-xs">{item.generatorId}</span>
                </div>
                <div className="queue-detail-item">
                  <span className="waste-type-tag text-xs">{item.wasteType}</span>
                </div>
                <div className="queue-detail-item">
                  <Scale size={14} className="text-slate-400" />
                  <span className="text-xs font-semibold">{item.weightKg.toFixed(2)} kg</span>
                </div>
                <div className="queue-detail-item">
                  <Flame size={14} className="text-slate-400" />
                  <span className="text-xs">{item.contaminationLevel}% Contamination</span>
                </div>
              </div>

              <div className="queue-card-bottom">
                <span className="text-xs text-slate-500">
                  Created: {new Date(item.createdAt).toLocaleTimeString()} | Attempts: {item.syncAttemptCount || 0}
                </span>

                <button
                  type="button"
                  onClick={() => removeShipment(item.shipment_id)}
                  className="btn-delete-item focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:outline-none"
                  aria-label={`Remove shipment ${item.shipment_id} from offline queue`}
                  title="Remove from local queue"
                >
                  <Trash2 size={12} /> Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
