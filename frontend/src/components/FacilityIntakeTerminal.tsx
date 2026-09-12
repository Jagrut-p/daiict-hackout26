import React, { useState, useEffect, useMemo, useId } from 'react';
import {
  Shipment,
  VerificationPayload,
  VerificationResponse,
  FacilityIntakeTerminalProps
} from '../types/intake';
import { fetchShipmentDetails, submitVerification, MOCK_SHIPMENTS } from '../services/intakeApi';

export const FacilityIntakeTerminal: React.FC<FacilityIntakeTerminalProps> = ({
  onFetchShipment = fetchShipmentDetails,
  onVerify = submitVerification,
  stationId = 'SCALE-BAY-01',
  operatorId = 'OP-7749',
  initialShipmentUuid = 'SHIP-1001'
}) => {
  const [searchUuid, setSearchUuid] = useState<string>(initialShipmentUuid);
  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [actualWeightInput, setActualWeightInput] = useState<string>('');
  const [operatorNotes, setOperatorNotes] = useState<string>('');
  const [isLoadingShipment, setIsLoadingShipment] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [verificationResult, setVerificationResult] = useState<VerificationResponse | null>(null);
  const [scaleStatus, setScaleStatus] = useState<'ONLINE' | 'CALIBRATING'>('ONLINE');

  const searchInputId = useId();
  const weightInputId = useId();

  // Load initial shipment on mount
  useEffect(() => {
    if (initialShipmentUuid) {
      handleSearch(initialShipmentUuid);
    }
  }, [initialShipmentUuid]);

  // Execute shipment search
  const handleSearch = async (uuidToFetch?: string) => {
    const targetUuid = (uuidToFetch ?? searchUuid).trim();
    if (!targetUuid) {
      setErrorMessage('Please enter a Shipment UUID.');
      return;
    }

    setIsLoadingShipment(true);
    setErrorMessage(null);
    setVerificationResult(null);

    try {
      const data = await onFetchShipment(targetUuid);
      if (data) {
        setShipment(data);
        setSearchUuid(data.shipmentUuid);
      } else {
        setShipment(null);
        setErrorMessage(`No active shipment found for UUID: "${targetUuid}"`);
      }
    } catch (err: any) {
      setShipment(null);
      setErrorMessage(err?.message || 'Failed to retrieve shipment records.');
    } finally {
      setIsLoadingShipment(false);
    }
  };

  // Parse actual weight numerically
  const actualWeight = useMemo<number | null>(() => {
    if (actualWeightInput.trim() === '') return null;
    const val = parseFloat(actualWeightInput);
    return isNaN(val) ? null : val;
  }, [actualWeightInput]);

  // Validation: Test Case 2 (The "Verify" button is disabled until a valid weight is entered)
  const isWeightValid = useMemo<boolean>(() => {
    return actualWeight !== null && !isNaN(actualWeight) && actualWeight > 0;
  }, [actualWeight]);

  // Deviation Calculations & Test Case 1 logic
  const deviationMetrics = useMemo(() => {
    if (!shipment || actualWeight === null || actualWeight <= 0) {
      return null;
    }

    const expected = shipment.expectedWeightTons;
    const diffTons = actualWeight - expected;
    const absDiffTons = Math.abs(diffTons);
    const deviationPct = expected > 0 ? (absDiffTons / expected) * 100 : 0;
    const isOver10Percent = deviationPct > 10.0;

    return {
      expectedTons: expected,
      actualTons: actualWeight,
      diffTons: Number(diffTons.toFixed(3)),
      absDiffTons: Number(absDiffTons.toFixed(3)),
      deviationPct: Number(deviationPct.toFixed(2)),
      isOver10Percent,
      isOverweight: diffTons > 0,
      isUnderweight: diffTons < 0
    };
  }, [shipment, actualWeight]);

  // Quick weight adjustment helpers
  const adjustWeight = (delta: number) => {
    const current = actualWeight ?? (shipment ? shipment.expectedWeightTons : 0);
    const next = Math.max(0, current + delta);
    setActualWeightInput(next.toFixed(2));
  };

  // Handle Verification submission
  const handleVerify = async () => {
    if (!shipment || !isWeightValid || actualWeight === null || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const deviationPct = deviationMetrics ? deviationMetrics.deviationPct : 0;
    const diffTons = deviationMetrics ? deviationMetrics.diffTons : 0;
    const requiresManualAudit = deviationMetrics ? deviationMetrics.isOver10Percent : false;

    const payload: VerificationPayload = {
      shipmentUuid: shipment.shipmentUuid,
      expectedWeightTons: shipment.expectedWeightTons,
      actualWeightTons: actualWeight,
      deviationPercentage: deviationPct,
      weightDifferenceTons: diffTons,
      requiresManualAudit,
      operatorNotes: operatorNotes.trim() || undefined,
      operatorId,
      weighStationId: stationId,
      verifiedAt: new Date().toISOString()
    };

    try {
      const response = await onVerify(payload);
      setVerificationResult(response);
      if (response.status === 'VERIFIED') {
        setShipment((prev) => (prev ? { ...prev, status: 'VERIFIED' } : null));
      } else if (response.status === 'AUDIT_REQUIRED') {
        setShipment((prev) => (prev ? { ...prev, status: 'AUDIT_REQUIRED' } : null));
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Verification failed. Please retry.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setActualWeightInput('');
    setOperatorNotes('');
    setVerificationResult(null);
    setErrorMessage(null);
  };

  return (
    <div className="w-full max-w-5xl mx-auto p-4 sm:p-6 lg:p-8 font-sans bg-slate-950 text-slate-100 min-h-screen">
      {/* Industrial Top Header */}
      <header className="border-b border-slate-800 pb-5 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-mono font-bold text-xl shadow-[0_0_15px_rgba(16,185,129,0.2)]">
              ⚖
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white uppercase font-mono">
                  Facility Intake Terminal
                </h1>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-800 text-slate-300 border border-slate-700">
                  MRV Gate V2.4
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-400 font-medium">
                Weigh-Bridge Ingress & Chain-of-Custody Weight Verification
              </p>
            </div>
          </div>

          {/* Telemetry & Operator Badge */}
          <div className="flex items-center gap-3 font-mono text-xs">
            <div className="bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-md flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-slate-400">Scale:</span>
              <span className="text-emerald-400 font-bold">{stationId}</span>
            </div>
            <div className="bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-md hidden sm:flex items-center gap-2">
              <span className="text-slate-400">Operator:</span>
              <span className="text-slate-200 font-semibold">{operatorId}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Lookup & Shipment Data Display (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Section 1: Shipment Search Bar */}
          <section className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-xl backdrop-blur-sm">
            <label
              htmlFor={searchInputId}
              className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 font-mono"
            >
              1. Shipment Identifier Lookup
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  id={searchInputId}
                  data-testid="shipment-uuid-input"
                  type="text"
                  value={searchUuid}
                  onChange={(e) => setSearchUuid(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="Scan barcode or enter UUID (e.g. SHIP-1001)..."
                  className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-white font-mono text-sm sm:text-base px-4 py-2.5 rounded-lg outline-none transition placeholder:text-slate-600 uppercase"
                />
                {searchUuid && (
                  <button
                    type="button"
                    onClick={() => setSearchUuid('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs px-1"
                    title="Clear"
                  >
                    ✕
                  </button>
                )}
              </div>
              <button
                type="button"
                data-testid="search-shipment-button"
                onClick={() => handleSearch()}
                disabled={isLoadingShipment || !searchUuid.trim()}
                className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-600 text-white px-5 py-2.5 rounded-lg font-bold text-sm tracking-wide transition flex items-center gap-2 border border-emerald-500/30 disabled:border-slate-800"
              >
                {isLoadingShipment ? (
                  <span className="animate-spin inline-block">↻</span>
                ) : (
                  <span>🔍</span>
                )}
                <span>Find Load</span>
              </button>
            </div>

            {/* Quick Test Presets */}
            <div className="mt-3 pt-3 border-t border-slate-800/80 flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-mono text-slate-500">Quick Test Load Presets:</span>
              {Object.keys(MOCK_SHIPMENTS).map((mockKey) => (
                <button
                  key={mockKey}
                  type="button"
                  onClick={() => {
                    setSearchUuid(mockKey);
                    handleSearch(mockKey);
                    handleReset();
                  }}
                  className={`text-[11px] font-mono px-2.5 py-1 rounded border transition ${
                    searchUuid === mockKey
                      ? 'bg-emerald-950 text-emerald-300 border-emerald-600'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200'
                  }`}
                >
                  {mockKey} ({MOCK_SHIPMENTS[mockKey].expectedWeightTons}t)
                </button>
              ))}
            </div>

            {errorMessage && (
              <div
                data-testid="search-error-message"
                className="mt-3 p-3 bg-red-950/50 border border-red-800 text-red-300 text-xs rounded-lg flex items-center gap-2"
              >
                <span>⚠</span>
                <span>{errorMessage}</span>
              </div>
            )}
          </section>

          {/* Section 2: Shipment Manifest Card (Display when UUID is entered & found) */}
          {shipment ? (
            <section
              data-testid="shipment-manifest-card"
              className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-bl-full pointer-events-none" />

              <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-emerald-400 font-mono text-xs font-bold uppercase tracking-wider">
                    Manifest Ingress Record
                  </span>
                  <span className="font-mono text-xs text-slate-500">/</span>
                  <span className="font-mono text-xs font-bold text-white bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                    {shipment.shipmentUuid}
                  </span>
                </div>
                <span
                  className={`text-[11px] font-mono px-2.5 py-0.5 rounded-full font-bold uppercase border ${
                    shipment.status === 'VERIFIED'
                      ? 'bg-emerald-950 text-emerald-300 border-emerald-700'
                      : shipment.status === 'AUDIT_REQUIRED'
                      ? 'bg-amber-950 text-amber-300 border-amber-700'
                      : 'bg-blue-950 text-blue-300 border-blue-700'
                  }`}
                >
                  {shipment.status}
                </span>
              </div>

              {/* Requirement Display Fields: Expected Weight, Declared Waste Type, Generator Name */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* 1. Generator Name */}
                <div className="bg-slate-950/80 border border-slate-800/80 p-3.5 rounded-lg sm:col-span-2">
                  <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 block mb-1">
                    🏢 Origin Generator Name
                  </span>
                  <p
                    data-testid="display-generator-name"
                    className="text-base font-bold text-white tracking-wide"
                  >
                    {shipment.generatorName}
                  </p>
                  {shipment.sourceLotId && (
                    <span className="text-[11px] font-mono text-slate-500 mt-1 block">
                      Source Lot ID: {shipment.sourceLotId}
                    </span>
                  )}
                </div>

                {/* 2. Declared Waste Type */}
                <div className="bg-slate-950/80 border border-slate-800/80 p-3.5 rounded-lg">
                  <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 block mb-1">
                    ♻ Declared Waste Type
                  </span>
                  <p
                    data-testid="display-waste-type"
                    className="text-sm font-semibold text-emerald-300 font-mono"
                  >
                    {shipment.declaredWasteType}
                  </p>
                </div>

                {/* 3. Expected Weight */}
                <div className="bg-slate-950/80 border border-slate-800/80 p-3.5 rounded-lg">
                  <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 block mb-1">
                    📦 Expected Manifest Weight
                  </span>
                  <div className="flex items-baseline gap-1.5">
                    <span
                      data-testid="display-expected-weight"
                      className="text-2xl font-black font-mono text-white tracking-tight"
                    >
                      {shipment.expectedWeightTons.toFixed(2)}
                    </span>
                    <span className="text-xs font-mono font-bold text-slate-400">TONS</span>
                  </div>
                </div>

                {/* Dispatch & Transport Details */}
                <div className="bg-slate-950/50 border border-slate-800/50 p-3 rounded-lg flex items-center justify-between sm:col-span-2 text-xs font-mono text-slate-400">
                  <span>🚛 Vehicle: {shipment.vehicleRegistration || 'GJ-01-LOGISTICS'}</span>
                  <span>Driver: {shipment.driverName || 'Verified Carrier'}</span>
                  {shipment.dispatchedAt && <span>Dispatched: {shipment.dispatchedAt}</span>}
                </div>
              </div>
            </section>
          ) : (
            <div className="bg-slate-900/40 border border-dashed border-slate-800 rounded-xl p-8 text-center">
              <div className="text-3xl text-slate-600 mb-2">📋</div>
              <p className="text-sm text-slate-400 font-medium">No shipment loaded</p>
              <p className="text-xs text-slate-600 mt-1 font-mono">
                Enter or scan a Shipment UUID above to display expected weight and origin details.
              </p>
            </div>
          )}
        </div>

        {/* Right Column: Weigh-Bridge Digital Intake & Verification Console (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <section className="bg-slate-900 border-2 border-slate-800 rounded-xl p-5 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono">
                  2. Scale Intake Measurement
                </h2>
              </div>
              <span className="text-[10px] font-mono text-slate-500 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                LIVE TARE / NET
              </span>
            </div>

            {/* Scale Numeric Input for Actual Received Weight */}
            <div className="mb-4">
              <div className="flex justify-between items-center mb-1.5">
                <label
                  htmlFor={weightInputId}
                  className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono"
                >
                  Actual Received Weight (Tons) <span className="text-emerald-400">*</span>
                </label>
                {shipment && (
                  <button
                    type="button"
                    onClick={() => setActualWeightInput(shipment.expectedWeightTons.toFixed(2))}
                    className="text-[10px] font-mono text-emerald-400 hover:text-emerald-300 hover:underline"
                  >
                    Sync With Expected ({shipment.expectedWeightTons}t)
                  </button>
                )}
              </div>

              {/* Digital LED / Monospace Scale Readout */}
              <div className="relative bg-slate-950 border-2 border-slate-700 focus-within:border-emerald-500 rounded-lg p-2 flex items-center transition shadow-inner">
                <input
                  id={weightInputId}
                  data-testid="actual-weight-input"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={actualWeightInput}
                  onChange={(e) => {
                    setActualWeightInput(e.target.value);
                    setVerificationResult(null);
                  }}
                  className="w-full bg-transparent text-right font-mono font-black text-3xl sm:text-4xl text-emerald-400 outline-none pr-3 tracking-wider placeholder:text-slate-800"
                />
                <span className="font-mono text-sm font-black text-slate-400 pl-2 border-l border-slate-800">
                  TONS
                </span>
              </div>

              {/* Quick Stepper Buttons */}
              <div className="grid grid-cols-4 gap-1.5 mt-2">
                <button
                  type="button"
                  onClick={() => adjustWeight(-1.0)}
                  disabled={!shipment}
                  className="bg-slate-950 hover:bg-slate-800 disabled:opacity-40 text-slate-300 text-xs font-mono py-1 rounded border border-slate-800 transition"
                >
                  -1.0t
                </button>
                <button
                  type="button"
                  onClick={() => adjustWeight(-0.1)}
                  disabled={!shipment}
                  className="bg-slate-950 hover:bg-slate-800 disabled:opacity-40 text-slate-300 text-xs font-mono py-1 rounded border border-slate-800 transition"
                >
                  -0.1t
                </button>
                <button
                  type="button"
                  onClick={() => adjustWeight(+0.1)}
                  disabled={!shipment}
                  className="bg-slate-950 hover:bg-slate-800 disabled:opacity-40 text-slate-300 text-xs font-mono py-1 rounded border border-slate-800 transition"
                >
                  +0.1t
                </button>
                <button
                  type="button"
                  onClick={() => adjustWeight(+1.0)}
                  disabled={!shipment}
                  className="bg-slate-950 hover:bg-slate-800 disabled:opacity-40 text-slate-300 text-xs font-mono py-1 rounded border border-slate-800 transition"
                >
                  +1.0t
                </button>
              </div>
            </div>

            {/* Logic: Weight Deviation Comparison Display */}
            {deviationMetrics && (
              <div className="mb-4 space-y-2">
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-xs font-mono">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-slate-400">Expected vs Actual Delta:</span>
                    <span
                      data-testid="weight-difference-text"
                      className={`font-bold ${
                        deviationMetrics.diffTons === 0
                          ? 'text-slate-300'
                          : deviationMetrics.diffTons > 0
                          ? 'text-amber-400'
                          : 'text-blue-400'
                      }`}
                    >
                      {deviationMetrics.diffTons > 0 ? '+' : ''}
                      {deviationMetrics.diffTons.toFixed(2)} Tons
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Deviation Percentage:</span>
                    <span
                      data-testid="deviation-percentage-text"
                      className={`font-bold text-sm ${
                        deviationMetrics.isOver10Percent ? 'text-amber-400' : 'text-emerald-400'
                      }`}
                    >
                      {deviationMetrics.deviationPct.toFixed(2)}%
                    </span>
                  </div>

                  {/* Tolerance Indicator Progress */}
                  <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mt-2">
                    <div
                      className={`h-full transition-all duration-300 ${
                        deviationMetrics.isOver10Percent ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}
                      style={{
                        width: `${Math.min(100, (deviationMetrics.deviationPct / 20) * 100)}%`
                      }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                    <span>0% (Exact)</span>
                    <span className="text-slate-400 font-bold">10% Threshold</span>
                    <span>20%+</span>
                  </div>
                </div>

                {/* TEST CASE 1: Prominent Yellow Warning Banner when deviation > 10% */}
                {deviationMetrics.isOver10Percent && (
                  <div
                    data-testid="weight-discrepancy-warning"
                    className="p-4 bg-amber-500/10 border-2 border-amber-500 text-amber-200 rounded-lg shadow-lg animate-pulse"
                    role="alert"
                  >
                    <div className="flex items-start gap-3">
                      <div className="text-2xl text-amber-400 font-bold shrink-0">⚠️</div>
                      <div className="space-y-1">
                        <p className="font-extrabold text-sm text-amber-300 tracking-wide font-mono uppercase">
                          Weight Discrepancy Detected - Requires Manual Audit.
                        </p>
                        <p className="text-xs text-amber-200/90 leading-relaxed">
                          Actual weight ({deviationMetrics.actualTons.toFixed(2)}t) deviates by{' '}
                          <strong>{deviationMetrics.deviationPct.toFixed(2)}%</strong> (threshold:
                          10.00%) from declared manifest weight (
                          {deviationMetrics.expectedTons.toFixed(2)}t). This record will be flagged
                          for MRV auditor review.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Normal within-tolerance banner */}
                {!deviationMetrics.isOver10Percent && (
                  <div
                    data-testid="tolerance-ok-banner"
                    className="p-2.5 bg-emerald-950/40 border border-emerald-800 text-emerald-300 text-xs rounded-lg flex items-center gap-2 font-mono"
                  >
                    <span>✓</span>
                    <span>Within Permissible Tolerance (≤ 10.0% variance)</span>
                  </div>
                )}
              </div>
            )}

            {/* Operator Observation Notes */}
            <div className="mb-5">
              <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-1">
                Optional Weigh-Bridge Audit Notes
              </label>
              <textarea
                value={operatorNotes}
                onChange={(e) => setOperatorNotes(e.target.value)}
                placeholder="Visual contamination notes, moisture observation, scale seal #..."
                rows={2}
                className="w-full bg-slate-950 border border-slate-800 focus:border-slate-600 text-white text-xs p-2.5 rounded-lg outline-none font-mono placeholder:text-slate-700 resize-none"
              />
            </div>

            {/* TEST CASE 2: Action "Verify & Finalize Record" button disabled until a valid weight is entered */}
            <button
              type="button"
              data-testid="verify-record-button"
              onClick={handleVerify}
              disabled={!isWeightValid || isSubmitting || !shipment}
              className={`w-full py-3.5 px-4 rounded-lg font-mono font-black text-sm tracking-wider uppercase transition flex items-center justify-center gap-2 shadow-lg ${
                isWeightValid && shipment && !isSubmitting
                  ? deviationMetrics?.isOver10Percent
                    ? 'bg-amber-600 hover:bg-amber-500 text-slate-950 shadow-amber-900/30'
                    : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-900/30'
                  : 'bg-slate-800 text-slate-500 border border-slate-700/50 cursor-not-allowed opacity-60'
              }`}
            >
              {isSubmitting ? (
                <>
                  <span className="animate-spin inline-block">↻</span>
                  <span>Signing & Finalizing Record...</span>
                </>
              ) : (
                <>
                  <span>📝</span>
                  <span>Verify & Finalize Record</span>
                </>
              )}
            </button>

            {!isWeightValid && shipment && (
              <p className="text-[11px] font-mono text-slate-500 text-center mt-2">
                * Please enter a valid non-zero weight to enable verification.
              </p>
            )}
          </section>

          {/* Verification Audit Certificate / Success Card */}
          {verificationResult && (
            <section
              data-testid="verification-success-card"
              className={`p-4 rounded-xl border-2 font-mono text-xs shadow-xl animate-fadeIn ${
                verificationResult.requiresManualAudit
                  ? 'bg-amber-950/40 border-amber-600 text-amber-200'
                  : 'bg-emerald-950/40 border-emerald-600 text-emerald-200'
              }`}
            >
              <div className="flex items-center justify-between border-b border-current/20 pb-2 mb-2">
                <span className="font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <span>{verificationResult.requiresManualAudit ? '⚠️' : '✅'}</span>
                  <span>{verificationResult.status}</span>
                </span>
                <span className="font-bold">{verificationResult.verificationId}</span>
              </div>
              <p className="mb-2 text-[11px] leading-relaxed opacity-90">
                {verificationResult.message}
              </p>
              <div className="space-y-1 text-[10px] opacity-80 pt-2 border-t border-current/20">
                <div className="flex justify-between">
                  <span>Shipment UUID:</span>
                  <span className="font-bold">{verificationResult.shipmentUuid}</span>
                </div>
                <div className="flex justify-between">
                  <span>Final Verified Weight:</span>
                  <span className="font-bold">{verificationResult.actualWeightTons} Tons</span>
                </div>
                <div className="flex justify-between">
                  <span>Recorded Variance:</span>
                  <span className="font-bold">{verificationResult.deviationPercentage.toFixed(2)}%</span>
                </div>
                {verificationResult.proofHash && (
                  <div className="flex justify-between truncate pt-1">
                    <span>Proof Hash:</span>
                    <span className="font-bold truncate max-w-[180px]">{verificationResult.proofHash}</span>
                  </div>
                )}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
};

export default FacilityIntakeTerminal;
