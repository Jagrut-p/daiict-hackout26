import React, { useState, useEffect, useCallback, FormEvent } from 'react';
import {
  WasteFormData,
  WasteType,
  WasteShipment,
} from '../types/waste';
import { generateUUIDv4, enqueueShipment } from '../services/idbStorage';
import { syncService } from '../services/syncService';
import { apiService, BackendGenerator } from '../services/apiService';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import {
  Send,
  WifiOff,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Flame,
  Scale,
  Building2,
  Trash2,
  Sparkles,
  RefreshCw,
  Info,
} from 'lucide-react';

interface FormAlertState {
  type: 'offline_queued' | 'success' | 'conflict' | 'error' | 'info';
  message: string;
  shipmentId?: string;
  statusCode?: number;
  timestamp: string;
}

const WASTE_TYPE_OPTIONS: { value: WasteType; label: string; icon: string; category: string }[] = [
  { value: 'Recyclable', label: 'Recyclables (Dry / Metals)', icon: 'â™»ï¸', category: 'Recycling' },
  { value: 'Organic', label: 'Organic (Compost / Food)', icon: 'ðŸŒ±', category: 'Compostable' },
  { value: 'Hazardous', label: 'Hazardous (Toxic / Chemical)', icon: 'â˜£ï¸', category: 'Specialized' },
  { value: 'E-Waste', label: 'Electronic Waste (E-Waste)', icon: 'ðŸ”Œ', category: 'High Value' },
  { value: 'Industrial', label: 'Industrial Scrap (Bulk)', icon: 'ðŸ­', category: 'Heavy Duty' },
  { value: 'Medical', label: 'Biomedical (Clinical)', icon: 'ðŸ’‰', category: 'Regulated' },
  { value: 'Construction', label: 'Construction & Debris', icon: 'ðŸ§±', category: 'Bulk' },
];

export const WasteCollectionForm: React.FC = () => {
  // Form input state
  const [formData, setFormData] = useState<WasteFormData>({
    generatorId: 'GEN-TX-4091',
    wasteType: 'Recyclable',
    weightKg: 125.5,
    contaminationLevel: 8.5,
  });

  // Submission & UI feedback state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentAlert, setCurrentAlert] = useState<FormAlertState | null>(null);
  const [lastGeneratedId, setLastGeneratedId] = useState<string | null>(null);
  const [backendGenerators, setBackendGenerators] = useState<BackendGenerator[]>([]);

  // Network status hook (listens to navigator.onLine & online/offline events)
  const { isOnline } = useNetworkStatus();

  // Load generators from backend on mount
  useEffect(() => {
    let isMounted = true;
    apiService.getGenerators().then((data) => {
      if (isMounted && data && data.length > 0) {
        setBackendGenerators(data);
      }
    }).catch(() => {});
    return () => { isMounted = false; };
  }, []);

  /**
   * TEST CASE 2: Network restores -> Component automatically processes the local queue.
   */
  useEffect(() => {
    let isMounted = true;

    const handleAutoSyncOnReconnect = async () => {
      if (isOnline && isMounted) {
        console.log('[WasteCollectionForm] Connection restored. Automatically processing local queue...');
        const res = await syncService.processQueue();
        if (res.processed > 0 && isMounted) {
          // If the last queued item was synced, show notification
          if (res.failed === 0 && res.conflicted === 0) {
            setCurrentAlert({
              type: 'success',
              message: `Auto-sync complete: ${res.succeeded} offline shipment(s) pushed to server.`,
              timestamp: new Date().toLocaleTimeString(),
            });
          }
        }
      }
    };

    handleAutoSyncOnReconnect();

    return () => {
      isMounted = false;
    };
  }, [isOnline]);

  // Form input change handlers
  const handleChange = (field: keyof WasteFormData, value: string | number) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const resetForm = () => {
    setFormData({
      generatorId: `GEN-TX-${Math.floor(1000 + Math.random() * 9000)}`,
      wasteType: 'Recyclable',
      weightKg: '',
      contaminationLevel: '',
    });
    setCurrentAlert(null);
  };

  /**
   * Prefills test fixtures for quick demonstration
   */
  const prefillSample = (preset: 'normal' | 'hazardous' | 'conflict_test') => {
    if (preset === 'normal') {
      setFormData({
        generatorId: `GEN-FACILITY-${Math.floor(100 + Math.random() * 900)}`,
        wasteType: 'Recyclable',
        weightKg: +(Math.random() * 200 + 50).toFixed(1),
        contaminationLevel: +(Math.random() * 12 + 2).toFixed(1),
      });
    } else if (preset === 'hazardous') {
      setFormData({
        generatorId: `LAB-BIO-${Math.floor(500 + Math.random() * 400)}`,
        wasteType: 'Hazardous',
        weightKg: +(Math.random() * 45 + 10).toFixed(1),
        contaminationLevel: +(Math.random() * 35 + 20).toFixed(1),
      });
    } else if (preset === 'conflict_test') {
      setFormData({
        generatorId: 'DUPLICATE-CLAIM-GENERATOR',
        wasteType: 'Industrial',
        weightKg: 850.0,
        contaminationLevel: 15.0,
      });
    }
  };

  /**
   * Form Submission Handler
   */
  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();

      // Basic client validation
      if (!formData.generatorId.trim()) {
        setCurrentAlert({
          type: 'error',
          message: 'Generator ID is required.',
          timestamp: new Date().toLocaleTimeString(),
        });
        return;
      }

      const weight = Number(formData.weightKg);
      if (isNaN(weight) || weight <= 0) {
        setCurrentAlert({
          type: 'error',
          message: 'Please enter a valid positive weight in kg.',
          timestamp: new Date().toLocaleTimeString(),
        });
        return;
      }

      const contamination = Number(formData.contaminationLevel);
      if (isNaN(contamination) || contamination < 0 || contamination > 100) {
        setCurrentAlert({
          type: 'error',
          message: 'Contamination level must be between 0% and 100%.',
          timestamp: new Date().toLocaleTimeString(),
        });
        return;
      }

      setIsSubmitting(true);
      setCurrentAlert(null);

      // 1. Generate local UUIDv4 as the shipment_id
      const localShipmentId = generateUUIDv4();
      setLastGeneratedId(localShipmentId);

      const newShipment: WasteShipment = {
        shipment_id: localShipmentId,
        generatorId: formData.generatorId.trim(),
        wasteType: formData.wasteType,
        weightKg: weight,
        contaminationLevel: contamination,
        createdAt: new Date().toISOString(),
        status: 'queued',
        syncAttemptCount: 0,
      };

      try {
        /**
         * TEST CASE 1: User submits while offline -> UI shows "Saved locally. Waiting for connection."
         */
        if (!isOnline) {
          // Save directly to the local offline queue (IndexedDB / LocalStorage)
          await enqueueShipment(newShipment);

          setCurrentAlert({
            type: 'offline_queued',
            message: 'Saved locally. Waiting for connection.',
            shipmentId: localShipmentId,
            timestamp: new Date().toLocaleTimeString(),
          });
          setIsSubmitting(false);
          return;
        }

        /**
         * Online submission: Attempt to POST to /shipments/sync
         */
        // First record in queue as transient buffer
        await enqueueShipment(newShipment);

        const syncResult = await syncService.syncShipment(newShipment);

        /**
         * TEST CASE 3: Server returns 200 OK (idempotent success) or 201 Created -> Remove item from queue and show success message.
         */
        if (syncResult.status === 200 || syncResult.status === 201) {
          const statusLabel = syncResult.status === 201 ? '201 Created' : '200 OK';
          setCurrentAlert({
            type: 'success',
            message: `Shipment submitted successfully! Server responded with ${statusLabel}.`,
            shipmentId: localShipmentId,
            statusCode: syncResult.status,
            timestamp: new Date().toLocaleTimeString(),
          });
        }
        /**
         * TEST CASE 4: Server returns 409 Conflict (duplicate claim) -> Remove from queue but show a red alert to the user.
         */
        else if (syncResult.status === 409) {
          setCurrentAlert({
            type: 'conflict',
            message: `409 Conflict: Duplicate claim detected for shipment ${localShipmentId}. Item was removed from the local queue to prevent deadlock.`,
            shipmentId: localShipmentId,
            statusCode: 409,
            timestamp: new Date().toLocaleTimeString(),
          });
        }
        /**
         * Other errors (500, network drop)
         */
        else {
          setCurrentAlert({
            type: 'error',
            message: `Server returned HTTP ${syncResult.status}: ${syncResult.message}. Shipment remains saved in local queue.`,
            shipmentId: localShipmentId,
            statusCode: syncResult.status,
            timestamp: new Date().toLocaleTimeString(),
          });
        }
      } catch (err) {
        console.error('Submission error:', err);
        setCurrentAlert({
          type: 'error',
          message: 'An unexpected error occurred during submission. The entry was safely saved to the local offline queue.',
          shipmentId: localShipmentId,
          timestamp: new Date().toLocaleTimeString(),
        });
      } finally {
        setIsSubmitting(false);
      }
    },
    [formData, isOnline]
  );

  return (
    <div className="wcf-root">
      <div className="wcf-ambient" />

      {/* Header */}
      <div className="wcf-header">
        <div className="wcf-header-left">
          <div className="wcf-header-icon-wrap">
            <Sparkles size={22} className="wcf-header-icon" />
          </div>
          <div>
            <h2 className="wcf-title">Waste Collection Manifest</h2>
            <p className="wcf-subtitle">
              Field-ready offline data entry with automated synchronization &amp; local IndexedDB queuing
            </p>
          </div>
        </div>

        <div
          role="status"
          aria-label={isOnline ? 'Online mode: Direct synchronization active' : 'Offline mode: Buffered to local queue'}
          className={`wcf-status-badge ${isOnline ? 'wcf-status-badge--online' : 'wcf-status-badge--offline'}`}
        >
          <span className="wcf-status-dot">
            <span className="wcf-status-dot-ping" style={{ background: isOnline ? '#34d399' : '#fbbf24' }} />
            <span className="wcf-status-dot-core" style={{ background: isOnline ? '#10b981' : '#f59e0b' }} />
          </span>
          <span>{isOnline ? 'Online (Direct Sync)' : 'Offline (Local Queue)'}</span>
        </div>
      </div>

      {/* Quick Presets */}
      <div className="wcf-presets">
        <p className="wcf-presets-label">Quick Field Test Presets</p>
        <div className="wcf-presets-row">
          <button type="button" onClick={() => prefillSample('normal')} className="wcf-preset-btn" title="Fill standard recyclable batch">
            <span>â™»ï¸</span>
            <span>Recyclables (Standard)</span>
          </button>
          <button type="button" onClick={() => prefillSample('hazardous')} className="wcf-preset-btn" title="Fill hazardous material batch">
            <span>â˜£ï¸</span>
            <span>Hazardous Batch</span>
          </button>
          <button type="button" onClick={() => prefillSample('conflict_test')} className="wcf-preset-btn wcf-preset-btn--warn" title="Prefill a duplicate claim test fixture">
            <span>âš ï¸</span>
            <span>Conflict Test Fixture</span>
          </button>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit}>
        <div className="wcf-fields-grid">
          {/* Generator ID */}
          <div className="wcf-field">
            <label htmlFor="generatorId" className="wcf-field-label">
              <Building2 size={14} style={{ color: '#818cf8' }} />
              <span>Generator Identifier (Facility / Origin ID)</span>
              <span style={{ color: '#fb7185', fontWeight: 700 }}>*</span>
            </label>
            <input
              id="generatorId"
              type="text"
              list="registeredGeneratorsList"
              className="wcf-field-input wcf-field-input--mono"
              placeholder="e.g., GEN-GJ-01 or GEN-TX-4091"
              value={formData.generatorId}
              onChange={(e) => {
                const val = e.target.value;
                handleChange('generatorId', val);
                const matched = backendGenerators.find((g) => g.id === val);
                if (matched) {
                  handleChange('weightKg', matched.quantity_tons * 1000);
                  handleChange('contaminationLevel', matched.contamination_pct);
                  if (matched.waste_type) {
                    const formatted = matched.waste_type.charAt(0).toUpperCase() + matched.waste_type.slice(1).toLowerCase();
                    handleChange('wasteType', formatted as WasteType);
                  }
                }
              }}
              required
            />
            {backendGenerators.length > 0 && (
              <datalist id="registeredGeneratorsList">
                {backendGenerators.map((gen) => (
                  <option key={gen.id} value={gen.id}>
                    {gen.name} ({gen.waste_type} - {gen.quantity_tons}t)
                  </option>
                ))}
              </datalist>
            )}
            <span className="wcf-field-hint">Unique identifier for the waste producer or select registered facility</span>
          </div>

          {/* Waste Type */}
          <div className="wcf-field">
            <label htmlFor="wasteType" className="wcf-field-label">
              <Trash2 size={14} style={{ color: '#818cf8' }} />
              <span>Waste Classification Type</span>
              <span style={{ color: '#fb7185', fontWeight: 700 }}>*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <select
                id="wasteType"
                className="wcf-field-input"
                style={{ cursor: 'pointer', appearance: 'none', paddingRight: '2.5rem' }}
                value={formData.wasteType}
                onChange={(e) => handleChange('wasteType', e.target.value as WasteType)}
                required
              >
                {WASTE_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value} style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)' }}>
                    {opt.icon} {opt.label}
                  </option>
                ))}
              </select>
              <div style={{ position: 'absolute', right: '0.85rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-muted)' }}>
                <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
            <span className="wcf-field-hint">Select appropriate material safety and handling classification</span>
          </div>

          {/* Weight */}
          <div className="wcf-field">
            <label htmlFor="weightKg" className="wcf-field-label">
              <Scale size={14} style={{ color: '#818cf8' }} />
              <span>Measured Net Weight (kg)</span>
              <span style={{ color: '#fb7185', fontWeight: 700 }}>*</span>
            </label>
            <div className="wcf-field-input-wrap">
              <input
                id="weightKg"
                type="number"
                step="0.01"
                min="0.01"
                max="50000"
                className="wcf-field-input wcf-field-input--mono"
                style={{ paddingRight: '3.5rem' }}
                placeholder="0.00"
                value={formData.weightKg}
                onChange={(e) => handleChange('weightKg', e.target.value ? parseFloat(e.target.value) : '')}
                required
              />
              <span className="wcf-field-unit">kg</span>
            </div>
            <span className="wcf-field-hint">Calibrated scale reading in kilograms</span>
          </div>

          {/* Contamination */}
          <div className="wcf-field">
            <label htmlFor="contaminationLevel" className="wcf-field-label">
              <Flame size={14} style={{ color: '#818cf8' }} />
              <span>Contamination Level (0 - 100%)</span>
              <span style={{ color: '#fb7185', fontWeight: 700 }}>*</span>
            </label>
            <div className="wcf-field-input-wrap">
              <input
                id="contaminationLevel"
                type="number"
                step="0.1"
                min="0"
                max="100"
                className="wcf-field-input wcf-field-input--mono"
                style={{ paddingRight: '3rem' }}
                placeholder="0.0"
                value={formData.contaminationLevel}
                onChange={(e) => handleChange('contaminationLevel', e.target.value ? parseFloat(e.target.value) : '')}
                required
              />
              <span className="wcf-field-unit">%</span>
            </div>
            <div className="wcf-contam-track">
              <div
                className="wcf-contam-fill"
                style={{
                  width: `${Math.min(100, Math.max(0, Number(formData.contaminationLevel) || 0))}%`,
                  background: Number(formData.contaminationLevel) > 25
                    ? '#f43f5e'
                    : Number(formData.contaminationLevel) > 10
                    ? '#fbbf24'
                    : '#34d399',
                }}
              />
            </div>
          </div>
        </div>

        {/* Alert */}
        {currentAlert && (
          <div
            id="form-feedback-alert"
            role="alert"
            className={`wcf-alert ${
              currentAlert.type === 'offline_queued' ? 'wcf-alert--offline'
                : currentAlert.type === 'success' ? 'wcf-alert--success'
                : currentAlert.type === 'conflict' ? 'wcf-alert--conflict'
                : currentAlert.type === 'error' ? 'wcf-alert--error'
                : 'wcf-alert--info'
            }`}
          >
            <div className="wcf-alert-icon">
              {currentAlert.type === 'offline_queued' && <WifiOff size={20} style={{ color: '#f59e0b' }} />}
              {currentAlert.type === 'success' && <CheckCircle2 size={20} style={{ color: '#10b981' }} />}
              {currentAlert.type === 'conflict' && <AlertCircle size={20} style={{ color: '#f43f5e' }} />}
              {currentAlert.type === 'error' && <AlertTriangle size={20} style={{ color: '#ef4444' }} />}
              {currentAlert.type === 'info' && <Info size={20} style={{ color: '#06b6d4' }} />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem', marginBottom: '0.15rem' }}>
                <span className="wcf-alert-type">
                  {currentAlert.type === 'offline_queued' && 'TEST CASE 1: OFFLINE QUEUED'}
                  {currentAlert.type === 'success' && 'TEST CASE 3: SYNC SUCCESS'}
                  {currentAlert.type === 'conflict' && 'TEST CASE 4: 409 CONFLICT DETECTED'}
                  {currentAlert.type === 'error' && 'TRANSMISSION ERROR'}
                  {currentAlert.type === 'info' && 'STATUS UPDATE'}
                </span>
                <span style={{ fontSize: '0.68rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{currentAlert.timestamp}</span>
              </div>
              <p className="wcf-alert-message">{currentAlert.message}</p>
              {currentAlert.shipmentId && (
                <div className="wcf-alert-uuid">
                  <span>Shipment UUIDv4:</span>
                  <code>{currentAlert.shipmentId}</code>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="wcf-actions">
          <button
            type="button"
            onClick={resetForm}
            className="wcf-reset-btn"
            disabled={isSubmitting}
          >
            <RefreshCw size={14} />
            <span>Reset Form</span>
          </button>

          <button
            type="submit"
            id="submit-waste-manifest-btn"
            className={`wcf-submit-btn ${!isOnline ? 'wcf-submit-btn--offline' : 'wcf-submit-btn--online'}`}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <><RefreshCw size={16} className="animate-spin" /><span>Processing...</span></>
            ) : !isOnline ? (
              <><WifiOff size={16} /><span>Save to Offline Queue</span></>
            ) : (
              <><Send size={16} /><span>Submit Shipment Manifest</span></>
            )}
          </button>
        </div>
      </form>

      {/* Footer */}
      {lastGeneratedId && (
        <div className="wcf-footer">
          <span>Last generated <code>shipment_id</code> (UUIDv4):</span>
          <span className="wcf-footer-uuid">{lastGeneratedId}</span>
        </div>
      )}
    </div>
  );
};

