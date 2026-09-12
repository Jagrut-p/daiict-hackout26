import React, { useState, useEffect } from 'react';
import { SyncAuditLogEntry } from '../types/waste';
import { syncService } from '../services/syncService';
import { Activity, Trash2, ArrowUpRight, ArrowDownLeft, ShieldAlert, Check, X } from 'lucide-react';

export const ShipmentAuditLog: React.FC = () => {
  const [logs, setLogs] = useState<SyncAuditLogEntry[]>([]);

  useEffect(() => {
    setLogs(syncService.getAuditLogs());

    const unsubscribe = syncService.onLog((entry) => {
      setLogs((prev) => [entry, ...prev.slice(0, 49)]);
    });

    return () => unsubscribe();
  }, []);

  const handleClear = () => {
    syncService.clearAuditLogs();
    setLogs([]);
  };

  return (
    <div className="card audit-log-container">
      <div className="audit-header">
        <div className="flex items-center gap-2">
          <Activity size={18} className="text-cyan-400" />
          <h3 className="card-title text-base font-bold">Network & Sync Telemetry</h3>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">{logs.length} events</span>
          <button
            type="button"
            onClick={handleClear}
            className="btn-clear-log"
            title="Clear telemetry logs"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {logs.length === 0 ? (
        <div className="audit-empty">
          <span className="text-xs text-slate-500">No network events recorded yet. Submit the form to observe live traffic.</span>
        </div>
      ) : (
        <div className="audit-log-stream font-mono">
          {logs.map((log) => (
            <div key={log.id} className={`audit-log-row audit-row-${log.action}`}>
              <div className="audit-row-meta">
                <span className="audit-time">{new Date(log.timestamp).toLocaleTimeString()}</span>
                {log.action === 'sync_start' && (
                  <span className="audit-action-tag tag-start">
                    <ArrowUpRight size={10} /> POST /shipments/sync
                  </span>
                )}
                {log.action === 'sync_success' && (
                  <span className="audit-action-tag tag-success">
                    <Check size={10} /> HTTP {log.statusCode || 200}
                  </span>
                )}
                {log.action === 'sync_conflict' && (
                  <span className="audit-action-tag tag-conflict">
                    <ShieldAlert size={10} /> HTTP 409 Conflict
                  </span>
                )}
                {log.action === 'sync_failed' && (
                  <span className="audit-action-tag tag-fail">
                    <X size={10} /> HTTP {log.statusCode || 'ERR'}
                  </span>
                )}
                {log.action === 'queued_offline' && (
                  <span className="audit-action-tag tag-offline">
                    <ArrowDownLeft size={10} /> IndexedDB Queued
                  </span>
                )}
              </div>

              <div className="audit-row-msg">
                <span className="audit-uuid">{log.shipment_id !== 'SYSTEM' && log.shipment_id !== 'QUEUE_PROCESSOR' ? `[${log.shipment_id.slice(0, 8)}...] ` : ''}</span>
                {log.message}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
