import React, { useState } from 'react';
import { MrvCertificate } from './MrvCertificate';
import {
  FileCheck,
  AlertTriangle,
  Flame,
  CheckCircle2,
  Lock,
  Sparkles,
} from 'lucide-react';

export const MrvCertificateViewer: React.FC = () => {
  const [activeScenario, setActiveScenario] = useState<'standard' | 'missing_version' | 'high_emissions'>('standard');

  return (
    <div className="mrv-viewer-wrapper space-y-4">
      {/* Test Scenario Selector Card */}
      <div className="card p-4 bg-slate-900/90 border border-slate-700/80 rounded-2xl shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
                <FileCheck size={18} />
              </span>
              <h3 className="font-bold text-base text-white">Waste-to-Carbon MRV Certificate Engine</h3>
              <span className="version-pill">Audit & Verification</span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Version-controlled climate impact verification records with strict anti-tamper constraints.
            </p>
          </div>

          {/* Test Case Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-400 font-medium">Test Scenarios:</span>

            <button
              type="button"
              onClick={() => setActiveScenario('standard')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                activeScenario === 'standard'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
              }`}
            >
              <Sparkles size={13} />
              <span>Standard Batch (V2.4.0)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveScenario('missing_version')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                activeScenario === 'missing_version'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
              }`}
              title="Test Case 1: Missing calculationVersion fallback"
            >
              <AlertTriangle size={13} />
              <span>Test Case 1: Missing Version</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveScenario('high_emissions')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                activeScenario === 'high_emissions'
                  ? 'bg-red-500 text-white shadow-md shadow-red-500/20'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
              }`}
              title="Test Case 3: Transport emissions exceed avoided methane"
            >
              <Flame size={13} />
              <span>Test Case 3: High Transport Emissions</span>
            </button>
          </div>
        </div>
      </div>

      {/* Render Certificate based on scenario */}
      {activeScenario === 'standard' && (
        <MrvCertificate
          batchId="BATCH-2026-GJ-9024"
          totalMethaneAvoided={8.42}
          transportEmissions={0.65}
          netCarbonOffset={7.77}
          calculationVersion="2.4.0"
          facilityName="Sector 30 CBG Anaerobic Digestion Plant"
          wasteTonnageDiverted={14.2}
          wasteType="APMC Organic Stubble & Wet Biomass"
          processingMethod="Anaerobic Digestion (Biogas + Bio-fertilizer)"
          dataQualityTier="Tier A"
          auditHash="0x4d9a1f73e8b265c0d12e34f56a789bc012345678"
          generatorIds={['GEN-GJ-01', 'GEN-GJ-03']}
        />
      )}

      {activeScenario === 'missing_version' && (
        <MrvCertificate
          batchId="BATCH-2026-GJ-UNVERIFIED"
          totalMethaneAvoided={4.18}
          transportEmissions={0.42}
          netCarbonOffset={3.76}
          calculationVersion={null} // Triggers Test Case 1
          facilityName="Koba Composting Center"
          wasteTonnageDiverted={6.0}
          wasteType="Municipal Segregated Organic"
          processingMethod="Aerobic Windrow Composting"
          dataQualityTier="Tier C"
          auditHash="0x0000000000000000000000000000000000000000"
          generatorIds={['GEN-GJ-02']}
        />
      )}

      {activeScenario === 'high_emissions' && (
        <MrvCertificate
          batchId="BATCH-2026-DEFICIT-04"
          totalMethaneAvoided={1.85}
          transportEmissions={3.42} // transportEmissions > totalMethaneAvoided (Triggers Test Case 3)
          netCarbonOffset={-1.57}
          calculationVersion="2.4.0"
          facilityName="Long-Haul Distant Facility (Inefficient Route)"
          wasteTonnageDiverted={2.5}
          wasteType="Low-Density Organic Leaves"
          processingMethod="Pyrolysis"
          dataQualityTier="Tier B"
          auditHash="0xee459ab12c879d01234f99887766554433221100"
          generatorIds={['GEN-GJ-04']}
        />
      )}

      {/* Test Case Verification Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs max-w-4xl mx-auto">
        <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
          <div className="font-semibold text-amber-400 flex items-center gap-1.5 mb-1">
            <CheckCircle2 size={14} /> Test Case 1: Missing Version
          </div>
          <p className="text-slate-400">
            If <code>calculationVersion</code> is null or omitted, renders fallback banner <strong>"ESTIMATED MRV RECORD — Version Unknown"</strong> with an amber warning triangle.
          </p>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
          <div className="font-semibold text-emerald-400 flex items-center gap-1.5 mb-1">
            <Lock size={14} /> Test Case 2: Read-Only Compliance
          </div>
          <p className="text-slate-400">
            All certificate fields, offsets, and IDs are strictly rendered as static read-only records with zero editable inputs, preventing user tampering.
          </p>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
          <div className="font-semibold text-red-400 flex items-center gap-1.5 mb-1">
            <CheckCircle2 size={14} /> Test Case 3: High Transport Emissions
          </div>
          <p className="text-slate-400">
            When <code>transportEmissions &gt; totalMethaneAvoided</code>, highlights <strong>Net Carbon Benefit</strong> in prominent red and displays a net-negative climate impact alert.
          </p>
        </div>
      </div>
    </div>
  );
};
