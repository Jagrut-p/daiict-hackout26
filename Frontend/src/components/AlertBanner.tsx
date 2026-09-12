import React, { useState, useEffect } from 'react';
import { NotificationAlert } from '../types/waste';
import { syncService } from '../services/syncService';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

export const AlertBanner: React.FC = () => {
  const [alerts, setAlerts] = useState<NotificationAlert[]>([]);

  useEffect(() => {
    const unsubscribe = syncService.onAlert((alert) => {
      setAlerts((prev) => [alert, ...prev]);

      if (alert.durationMs) {
        setTimeout(() => {
          setAlerts((prev) => prev.filter((a) => a.id !== alert.id));
        }, alert.durationMs);
      }
    });

    return () => unsubscribe();
  }, []);

  const dismissAlert = (id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  };

  if (alerts.length === 0) return null;

  return (
    <div className="toast-container" aria-live="polite">
      {alerts.slice(0, 3).map((alert) => (
        <div key={alert.id} className={`toast-card toast-${alert.type} animate-slide-in`}>
          <div className="toast-icon">
            {alert.type === 'success' && <CheckCircle2 size={20} className="text-emerald-400" />}
            {alert.type === 'conflict' && <AlertCircle size={20} className="text-rose-500" />}
            {alert.type === 'error' && <AlertTriangle size={20} className="text-red-400" />}
            {alert.type === 'info' && <Info size={20} className="text-cyan-400" />}
            {alert.type === 'warning' && <AlertTriangle size={20} className="text-amber-400" />}
          </div>

          <div className="toast-content">
            <h5 className="toast-title">{alert.title}</h5>
            <p className="toast-message">{alert.message}</p>
            {alert.shipmentId && (
              <span className="toast-uuid font-mono">UUID: {alert.shipmentId}</span>
            )}
          </div>

          <button
            type="button"
            onClick={() => dismissAlert(alert.id)}
            className="toast-close"
            aria-label="Close notification"
          >
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  );
};
