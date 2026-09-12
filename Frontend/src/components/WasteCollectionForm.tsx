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
    [formData, isOnline, enqueueShipment]
  );

  return (
    <div className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl sm:rounded-3xl p-4 sm:p-6 lg:p-8 shadow-xl backdrop-blur-xl relative overflow-hidden group">
      {/* Ambient Lighting & Specular Accent */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-emerald-400/40 to-transparent" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[var(--border-color)] relative z-10">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-400/25 flex items-center justify-center text-emerald-500 dark:text-emerald-400 shrink-0 shadow-lg shadow-emerald-500/10">
            <Sparkles size={22} />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-[var(--text-primary)]">
              Waste Collection Manifest
            </h2>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-0.5">
              Field-ready offline data entry with automated synchronization &amp; local IndexedDB queuing
            </p>
          </div>
        </div>

        <div
          role="status"
          aria-label={isOnline ? 'Online mode: Direct synchronization active' : 'Offline mode: Buffered to local queue'}
          className={`self-start sm:self-auto inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold font-mono border ${
            isOnline
              ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-600 dark:text-emerald-300'
              : 'bg-amber-500/10 border-amber-500/25 text-amber-600 dark:text-amber-300'
          }`}
        >
          <span className="relative flex h-2 w-2">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-70 ${isOnline ? 'bg-emerald-400' : 'bg-amber-400'}`} />
            <span className={`relative inline-flex rounded-full h-2 w-2 ${isOnline ? 'bg-emerald-500' : 'bg-amber-500'}`} />
          </span>
          <span>{isOnline ? 'Online (Direct Sync)' : 'Offline (Local Queue)'}</span>
        </div>
      </div>

      {/* Quick Field Test Presets */}
      <div className="py-4 border-b border-[var(--border-color)] relative z-10">
        <p className="text-[11px] font-mono uppercase tracking-wider text-[var(--text-muted)] font-semibold mb-2.5">
          Quick Field Test Presets
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <button
            type="button"
            onClick={() => prefillSample('normal')}
            className="min-h-[44px] flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card-subtle)] hover:bg-[var(--bg-card-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xs font-semibold active:scale-98 transition-all focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
            title="Fill standard recyclable batch"
            aria-label="Prefill standard recyclables batch"
          >
            <span>♻️</span>
            <span>Recyclables (Standard)</span>
          </button>
          <button
            type="button"
            onClick={() => prefillSample('hazardous')}
            className="min-h-[44px] flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card-subtle)] hover:bg-[var(--bg-card-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xs font-semibold active:scale-98 transition-all focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
            title="Fill hazardous material batch"
            aria-label="Prefill hazardous batch"
          >
            <span>☣️</span>
            <span>Hazardous Batch</span>
          </button>
          <button
            type="button"
            onClick={() => prefillSample('conflict_test')}
            className="min-h-[44px] flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/15 text-amber-600 dark:text-amber-300 text-xs font-semibold active:scale-98 transition-all focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
            title="Prefill a duplicate claim test fixture"
            aria-label="Prefill duplicate claim conflict test fixture"
          >
            <span>⚠️</span>
            <span>Conflict Test Fixture</span>
          </button>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 my-5 sm:my-6">
          {/* Generator ID */}
          <div className="space-y-1.5">
            <label htmlFor="generatorId" className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-[var(--text-secondary)]">
              <Building2 size={14} className="text-indigo-400 shrink-0" />
              <span>Generator Identifier (Origin ID)</span>
              <span className="text-rose-500 font-bold">*</span>
            </label>
            <input
              id="generatorId"
              type="text"
              list="registeredGeneratorsList"
              className="w-full h-12 sm:h-11 px-4 rounded-xl bg-[var(--input-bg)] border border-[var(--border-color)] text-[var(--text-primary)] font-mono text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none transition-all"
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
            <span className="text-[11px] text-[var(--text-muted)] block">Unique identifier for the waste producer or registered facility</span>
          </div>

          {/* Waste Type */}
          <div className="space-y-1.5">
            <label htmlFor="wasteType" className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-[var(--text-secondary)]">
              <Trash2 size={14} className="text-indigo-400 shrink-0" />
              <span>Waste Classification Type</span>
              <span className="text-rose-500 font-bold">*</span>
            </label>
            <div className="relative">
              <select
                id="wasteType"
                className="w-full h-12 sm:h-11 px-4 pr-10 rounded-xl bg-[var(--input-bg)] border border-[var(--border-color)] text-[var(--text-primary)] text-sm appearance-none cursor-pointer focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none transition-all"
                value={formData.wasteType}
                onChange={(e) => handleChange('wasteType', e.target.value as WasteType)}
                required
              >
                {WASTE_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value} className="bg-[var(--bg-surface)] text-[var(--text-primary)]">
                    {opt.icon} {opt.label}
                  </option>
                ))}
              </select>
              <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--text-muted)]">
                <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
            <span className="text-[11px] text-[var(--text-muted)] block">Select appropriate material safety and handling classification</span>
          </div>

          {/* Weight */}
          <div className="space-y-1.5">
            <label htmlFor="weightKg" className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-[var(--text-secondary)]">
              <Scale size={14} className="text-indigo-400 shrink-0" />
              <span>Measured Net Weight (kg)</span>
              <span className="text-rose-500 font-bold">*</span>
            </label>
            <div className="relative flex items-center">
              <input
                id="weightKg"
                type="number"
                step="0.01"
                min="0.01"
                max="50000"
                className="w-full h-12 sm:h-11 pl-4 pr-14 rounded-xl bg-[var(--input-bg)] border border-[var(--border-color)] text-[var(--text-primary)] font-mono text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none transition-all"
                placeholder="0.00"
                value={formData.weightKg}
                onChange={(e) => handleChange('weightKg', e.target.value ? parseFloat(e.target.value) : '')}
                required
              />
              <span className="absolute right-2.5 px-2 py-1 rounded-md bg-[var(--bg-card-subtle)] border border-[var(--border-color)] font-mono text-xs font-bold text-[var(--text-muted)] pointer-events-none">
                kg
              </span>
            </div>
            <span className="text-[11px] text-[var(--text-muted)] block">Calibrated scale reading in kilograms</span>
          </div>

          {/* Contamination */}
          <div className="space-y-1.5">
            <label htmlFor="contaminationLevel" className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-[var(--text-secondary)]">
              <Flame size={14} className="text-indigo-400 shrink-0" />
              <span>Contamination Level (0 - 100%)</span>
              <span className="text-rose-500 font-bold">*</span>
            </label>
            <div className="relative flex items-center">
              <input
                id="contaminationLevel"
                type="number"
                step="0.1"
                min="0"
                max="100"
                className="w-full h-12 sm:h-11 pl-4 pr-12 rounded-xl bg-[var(--input-bg)] border border-[var(--border-color)] text-[var(--text-primary)] font-mono text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none transition-all"
                placeholder="0.0"
                value={formData.contaminationLevel}
                onChange={(e) => handleChange('contaminationLevel', e.target.value ? parseFloat(e.target.value) : '')}
                required
              />
              <span className="absolute right-2.5 px-2 py-1 rounded-md bg-[var(--bg-card-subtle)] border border-[var(--border-color)] font-mono text-xs font-bold text-[var(--text-muted)] pointer-events-none">
                %
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-[var(--border-color)] overflow-hidden mt-1.5">
              <div
                className="h-full rounded-full transition-all duration-300"
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

        {/* Alert Feedback */}
        {currentAlert && (
          <div
            id="form-feedback-alert"
            role="alert"
            className={`p-4 rounded-2xl border flex items-start gap-3.5 my-4 transition-all ${
              currentAlert.type === 'offline_queued'
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-200'
                : currentAlert.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-200'
                : currentAlert.type === 'conflict'
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-200'
                : currentAlert.type === 'error'
                ? 'bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-200'
                : 'bg-cyan-500/10 border-cyan-500/30 text-cyan-700 dark:text-cyan-200'
            }`}
          >
            <div className="shrink-0 mt-0.5">
              {currentAlert.type === 'offline_queued' && <WifiOff size={20} className="text-amber-500" />}
              {currentAlert.type === 'success' && <CheckCircle2 size={20} className="text-emerald-500" />}
              {currentAlert.type === 'conflict' && <AlertCircle size={20} className="text-rose-500" />}
              {currentAlert.type === 'error' && <AlertTriangle size={20} className="text-red-500" />}
              {currentAlert.type === 'info' && <Info size={20} className="text-cyan-500" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                <span className="text-[11px] font-mono font-extrabold uppercase tracking-wider">
                  {currentAlert.type === 'offline_queued' && 'TEST CASE 1: OFFLINE QUEUED'}
                  {currentAlert.type === 'success' && 'TEST CASE 3: SYNC SUCCESS'}
                  {currentAlert.type === 'conflict' && 'TEST CASE 4: 409 CONFLICT DETECTED'}
                  {currentAlert.type === 'error' && 'TRANSMISSION ERROR'}
                  {currentAlert.type === 'info' && 'STATUS UPDATE'}
                </span>
                <span className="text-[11px] font-mono text-[var(--text-muted)]">{currentAlert.timestamp}</span>
              </div>
              <p className="text-xs sm:text-sm font-medium leading-relaxed">{currentAlert.message}</p>
              {currentAlert.shipmentId && (
                <div className="text-xs font-mono mt-2 flex items-center gap-2 opacity-90">
                  <span>Shipment UUID:</span>
                  <code className="px-1.5 py-0.5 rounded bg-[var(--bg-card-subtle)] border border-[var(--border-color)]">
                    {currentAlert.shipmentId}
                  </code>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Action Controls — Stacked mobile-first, thumb-reachable */}
        <div className="flex flex-col-reverse sm:flex-row gap-3 pt-5 border-t border-[var(--border-color)]">
          <button
            type="button"
            onClick={resetForm}
            className="w-full sm:w-auto min-h-[48px] sm:min-h-[44px] px-5 py-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card-subtle)] hover:bg-[var(--bg-card-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-sm font-semibold flex items-center justify-center gap-2 active:scale-98 transition-all focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
            disabled={isSubmitting}
            aria-label="Reset form fields to blank"
          >
            <RefreshCw size={14} />
            <span>Reset Form</span>
          </button>

          <button
            type="submit"
            id="submit-waste-manifest-btn"
            disabled={isSubmitting}
            aria-label={!isOnline ? "Save shipment to offline queue" : "Submit shipment manifest directly"}
            className={`w-full sm:flex-1 min-h-[52px] sm:min-h-[46px] px-6 py-3.5 rounded-xl text-white font-bold text-sm sm:text-base flex items-center justify-center gap-2.5 shadow-lg active:scale-98 transition-all disabled:opacity-50 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none ${
              !isOnline
                ? 'bg-gradient-to-r from-amber-500 to-orange-500 shadow-amber-500/25 hover:brightness-105'
                : 'bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-600 shadow-emerald-500/25 hover:brightness-105'
            }`}
          >
            {isSubmitting ? (
              <>
                <RefreshCw size={18} className="animate-spin" />
                <span>Processing Shipment...</span>
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

      {/* Footer */}
      {lastGeneratedId && (
        <div className="mt-4 pt-3 border-t border-[var(--border-color)] text-xs text-[var(--text-muted)] flex items-center flex-wrap gap-2">
          <span>Last generated <code>shipment_id</code> (UUIDv4):</span>
          <span className="font-mono font-bold text-emerald-500">{lastGeneratedId}</span>
        </div>
      )}
    </div>
  );
};
