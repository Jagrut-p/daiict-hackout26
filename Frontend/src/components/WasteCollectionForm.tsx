import React, { useState, useEffect, useCallback, FormEvent } from 'react';
import {
  WasteFormData,
  WasteType,
  WasteShipment,
} from '../types/waste';
import { generateUUIDv4, enqueueShipment } from '../services/idbStorage';
import { syncService } from '../services/syncService';
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
  { value: 'Organic', label: 'Organic / Bio-degradable', icon: '🌱', category: 'Compostable' },
  { value: 'Recyclable', label: 'Recyclables (Plastic, Metal, Glass)', icon: '♻️', category: 'Recycling' },
  { value: 'Hazardous', label: 'Hazardous Chemical / Toxic', icon: '☣️', category: 'Specialized' },
  { value: 'E-Waste', label: 'Electronic Waste (E-Waste)', icon: '🔌', category: 'High Value' },
  { value: 'Industrial', label: 'Industrial Scrap / Byproducts', icon: '🏭', category: 'Heavy Duty' },
  { value: 'Medical', label: 'Biomedical / Clinical', icon: '💉', category: 'Regulated' },
  { value: 'Construction', label: 'Construction & Demolition', icon: '🧱', category: 'Bulk' },
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

  // Network status hook (listens to navigator.onLine & online/offline events)
  const { isOnline } = useNetworkStatus();

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
    <div className="card form-container">
      {/* Form Header */}
      <div className="form-header">
        <div className="form-title-group">
          <div className="form-icon-badge">
            <Sparkles size={22} className="text-emerald-400" />
          </div>
          <div>
            <h2 className="form-title">Waste Collection Manifest</h2>
            <p className="form-subtitle">
              Offline-capable data entry with automatic synchronization & local IndexedDB queuing
            </p>
          </div>
        </div>

        {/* Network Status Badge */}
        <div className={`status-pill ${isOnline ? 'status-pill-online' : 'status-pill-offline'}`}>
          <span className="status-dot"></span>
          <span>{isOnline ? 'Online (Direct Sync)' : 'Offline (Local Queue)'}</span>
        </div>
      </div>

      {/* Preset Quick Fill Controls for Testing */}
      <div className="preset-bar">
        <span className="preset-label">Quick Test Presets:</span>
        <button
          type="button"
          onClick={() => prefillSample('normal')}
          className="preset-btn"
          title="Fill standard recyclable batch"
        >
          ♻️ Recyclables (Standard)
        </button>
        <button
          type="button"
          onClick={() => prefillSample('hazardous')}
          className="preset-btn"
          title="Fill hazardous material batch"
        >
          ☣️ Hazardous Batch
        </button>
        <button
          type="button"
          onClick={() => prefillSample('conflict_test')}
          className="preset-btn preset-btn-warning"
          title="Prefill a duplicate claim test fixture"
        >
          ⚠️ Conflict Test Fixture
        </button>
      </div>

      {/* Primary Form */}
      <form onSubmit={handleSubmit} className="form-body">
        <div className="form-grid">
          {/* Field 1: Generator ID */}
          <div className="input-group">
            <label htmlFor="generatorId" className="input-label">
              <Building2 size={16} className="label-icon" />
              Generator Identifier (Facility / Origin ID)
              <span className="required-star">*</span>
            </label>
            <input
              id="generatorId"
              type="text"
              className="input-control font-mono"
              placeholder="e.g., GEN-FACILITY-8821"
              value={formData.generatorId}
              onChange={(e) => handleChange('generatorId', e.target.value)}
              required
            />
            <span className="input-hint">Unique identifier for the waste producer or facility</span>
          </div>

          {/* Field 2: Waste Type (Dropdown) */}
          <div className="input-group">
            <label htmlFor="wasteType" className="input-label">
              <Trash2 size={16} className="label-icon" />
              Waste Classification Type
              <span className="required-star">*</span>
            </label>
            <div className="select-wrapper">
              <select
                id="wasteType"
                className="select-control"
                value={formData.wasteType}
                onChange={(e) => handleChange('wasteType', e.target.value as WasteType)}
                required
              >
                {WASTE_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.icon} {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <span className="input-hint">Select appropriate material safety and handling classification</span>
          </div>

          {/* Field 3: Weight (kg) */}
          <div className="input-group">
            <label htmlFor="weightKg" className="input-label">
              <Scale size={16} className="label-icon" />
              Measured Net Weight (kg)
              <span className="required-star">*</span>
            </label>
            <div className="input-addon-wrapper">
              <input
                id="weightKg"
                type="number"
                step="0.01"
                min="0.01"
                max="50000"
                className="input-control"
                placeholder="0.00"
                value={formData.weightKg}
                onChange={(e) => handleChange('weightKg', e.target.value ? parseFloat(e.target.value) : '')}
                required
              />
              <span className="input-addon">kg</span>
            </div>
            <span className="input-hint">Calibrated scale reading in kilograms</span>
          </div>

          {/* Field 4: Contamination Level (%) */}
          <div className="input-group">
            <label htmlFor="contaminationLevel" className="input-label">
              <Flame size={16} className="label-icon" />
              Contamination Level (0 - 100%)
              <span className="required-star">*</span>
            </label>
            <div className="input-addon-wrapper">
              <input
                id="contaminationLevel"
                type="number"
                step="0.1"
                min="0"
                max="100"
                className="input-control"
                placeholder="0.0"
                value={formData.contaminationLevel}
                onChange={(e) =>
                  handleChange('contaminationLevel', e.target.value ? parseFloat(e.target.value) : '')
                }
                required
              />
              <span className="input-addon">%</span>
            </div>
            {/* Visual Contamination Meter */}
            <div className="contamination-meter-track">
              <div
                className={`contamination-meter-bar ${
                  Number(formData.contaminationLevel) > 25
                    ? 'meter-high'
                    : Number(formData.contaminationLevel) > 10
                    ? 'meter-medium'
                    : 'meter-low'
                }`}
                style={{
                  width: `${Math.min(100, Math.max(0, Number(formData.contaminationLevel) || 0))}%`,
                }}
              ></div>
            </div>
          </div>
        </div>

        {/* Dynamic Alert Box Rendering specific test cases */}
        {currentAlert && (
          <div
            id="form-feedback-alert"
            className={`alert-box alert-${currentAlert.type} animate-slide-in`}
            role="alert"
          >
            <div className="alert-icon-wrapper">
              {currentAlert.type === 'offline_queued' && <WifiOff className="alert-icon text-amber-400" size={24} />}
              {currentAlert.type === 'success' && <CheckCircle2 className="alert-icon text-emerald-400" size={24} />}
              {currentAlert.type === 'conflict' && <AlertCircle className="alert-icon text-rose-500" size={24} />}
              {currentAlert.type === 'error' && <AlertTriangle className="alert-icon text-red-400" size={24} />}
              {currentAlert.type === 'info' && <Info className="alert-icon text-cyan-400" size={24} />}
            </div>

            <div className="alert-content">
              <div className="alert-title-row">
                <span className="alert-badge">
                  {currentAlert.type === 'offline_queued' && 'TEST CASE 1: OFFLINE QUEUED'}
                  {currentAlert.type === 'success' && 'TEST CASE 3: SYNC SUCCESS'}
                  {currentAlert.type === 'conflict' && 'TEST CASE 4: 409 CONFLICT DETECTED'}
                  {currentAlert.type === 'error' && 'TRANSMISSION ERROR'}
                  {currentAlert.type === 'info' && 'STATUS UPDATE'}
                </span>
                <span className="alert-time">{currentAlert.timestamp}</span>
              </div>

              {/* Exact user requirement string for Test Case 1: "Saved locally. Waiting for connection." */}
              <p className="alert-main-text">{currentAlert.message}</p>

              {currentAlert.shipmentId && (
                <div className="alert-shipment-id">
                  <span>Shipment UUIDv4:</span>
                  <code className="font-mono">{currentAlert.shipmentId}</code>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Form Action Controls */}
        <div className="form-actions">
          <button
            type="button"
            onClick={resetForm}
            className="btn btn-secondary"
            disabled={isSubmitting}
          >
            <RefreshCw size={16} />
            Reset Form
          </button>

          <button
            type="submit"
            id="submit-waste-manifest-btn"
            className={`btn btn-primary ${!isOnline ? 'btn-offline' : ''}`}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <RefreshCw size={18} className="animate-spin" />
                <span>Processing...</span>
              </>
            ) : !isOnline ? (
              <>
                <WifiOff size={18} />
                <span>Save to Offline Queue</span>
              </>
            ) : (
              <>
                <Send size={18} />
                <span>Submit Shipment Manifest</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* UUIDv4 Specification Footer */}
      {lastGeneratedId && (
        <div className="form-footer-info">
          <span>Last generated <code>shipment_id</code> (UUIDv4): </span>
          <span className="font-mono text-emerald-300">{lastGeneratedId}</span>
        </div>
      )}
    </div>
  );
};
