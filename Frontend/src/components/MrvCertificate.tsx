import React from 'react';
import { MrvCertificateProps } from '../types/mrv';
import {
  ShieldCheck,
  AlertTriangle,
  Lock,
  Leaf,
  Truck,
  TrendingUp,
  TrendingDown,
  Hash,
  Award,
  Download,
  Share2,
  FileCheck2,
  Info,
} from 'lucide-react';

export const MrvCertificate: React.FC<MrvCertificateProps> = ({
  batchId,
  totalMethaneAvoided,
  transportEmissions,
  netCarbonOffset,
  calculationVersion,
  facilityName = 'Pethapur Bio-Energy & Pyrolysis Facility',
  wasteTonnageDiverted = 12.5,
  wasteType = 'Organic Biomass & APMC Agro-Residue',
  processingMethod = 'Biochar Pyrolysis & Aerobic Digestion',
  dataQualityTier = 'Tier A',
  issuedAt = new Date().toISOString(),
  auditHash = '0x8f7c9e12a4b567890123456789abcdef01234567',
  generatorIds = ['GEN-GJ-01', 'GEN-GJ-03', 'GEN-GJ-04'],
}) => {
  // Test Case 1: Version check & warning icon fallback
  const isVersionMissing = !calculationVersion || calculationVersion.trim() === '';
  const versionDisplay = isVersionMissing ? 'Version Unknown' : `V${calculationVersion}`;

  // Test Case 3: High transport emissions comparison check
  const isNetNegative = transportEmissions > totalMethaneAvoided || netCarbonOffset < 0;

  // Format numbers safely with 3 decimal precision
  const formatTonne = (val: number | undefined | null) => {
    if (val === undefined || val === null || isNaN(val)) return '0.000';
    return (val >= 0 ? '+' : '') + val.toFixed(3);
  };

  const formattedIssuedDate = new Date(issuedAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="mrv-certificate-root max-w-4xl mx-auto my-4 transition-all duration-300">
      {/* Outer Certificate Frame with Glassmorphism & Metallic Borders */}
      <div className="relative rounded-3xl bg-gradient-to-b from-slate-900 via-slate-900/95 to-slate-950 border border-slate-700/80 shadow-2xl p-6 sm:p-8 overflow-hidden backdrop-blur-xl">
        {/* Subtle Decorative Background Watermark */}
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-80 h-80 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-80 h-80 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

        {/* ------------------------------------------------------------- */}
        {/* CRUCIAL COMPLIANCE BADGE (Requirement & Test Case 1)           */}
        {/* ------------------------------------------------------------- */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-6 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Award size={24} />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
                Waste-to-Carbon MRV Certificate
              </h2>
              <p className="text-xs text-slate-400">
                Verified Climate Accounting & Chain of Custody Record
              </p>
            </div>
          </div>

          {/* Compliance Version Badge & Banner */}
          <div
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-xs font-bold tracking-wide uppercase transition-colors ${
              isVersionMissing
                ? 'bg-amber-950/60 text-amber-300 border-amber-500/50 shadow-lg shadow-amber-950/40'
                : 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40 shadow-lg shadow-emerald-950/40'
            }`}
          >
            {isVersionMissing ? (
              <>
                <AlertTriangle size={15} className="text-amber-400 animate-pulse" />
                <span>ESTIMATED MRV RECORD — {versionDisplay}</span>
              </>
            ) : (
              <>
                <ShieldCheck size={15} className="text-emerald-400" />
                <span>ESTIMATED MRV RECORD — {versionDisplay}</span>
              </>
            )}
          </div>
        </div>

        {/* Mandatory Regulatory Disclaimer Sub-Header */}
        <div className="mt-3 px-3.5 py-2 rounded-xl bg-slate-800/40 border border-slate-700/50 text-[11px] text-slate-400 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Info size={13} className="text-cyan-400 shrink-0" />
            <span>
              Reported as <em>Estimated Climate Impact / MRV Record</em> under IPCC AR6 methodology. Not an independently certified carbon credit.
            </span>
          </span>
          <span className="px-2 py-0.5 rounded bg-slate-700/60 text-slate-300 font-mono text-[10px]">
            {dataQualityTier}
          </span>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* TEST CASE 3 WARNING BANNER (High Transport Emissions)         */}
        {/* ------------------------------------------------------------- */}
        {isNetNegative && (
          <div className="mt-4 p-4 rounded-2xl bg-red-950/80 border border-red-500/60 shadow-lg shadow-red-950/50 text-red-200 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-start gap-3">
              <AlertTriangle className="text-red-400 shrink-0 mt-0.5" size={20} />
              <div>
                <strong className="block text-sm font-bold text-red-100">
                  ⚠️ Net-Negative Climate Impact: Transport Emissions Exceed Avoidance
                </strong>
                <p className="text-xs text-red-300/90 mt-0.5">
                  Route logistics emissions ({transportEmissions.toFixed(3)} tCO₂e) are greater than the landfill methane avoided ({totalMethaneAvoided.toFixed(3)} tCO₂e). This batch resulted in a net carbon deficit of {Math.abs(netCarbonOffset).toFixed(3)} tCO₂e.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* CORE METRICS GRID (Strictly Read-Only - Test Case 2)          */}
        {/* ------------------------------------------------------------- */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          {/* 1. Avoided Methane Card */}
          <div className="card-mrv-metric p-5 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-emerald-500/30 transition-all">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
              <span className="font-semibold flex items-center gap-1.5 text-emerald-400">
                <Leaf size={15} /> Landfill Methane Avoided
              </span>
              <span className="font-mono text-[10px] text-slate-500">CH₄ → CO₂e</span>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              +{totalMethaneAvoided.toFixed(3)}
              <span className="text-xs font-normal text-slate-400 ml-1.5 font-sans">tCO₂e</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-2">
              Diverted biomass methane prevention (IPCC DOC formula).
            </p>
          </div>

          {/* 2. Transport Emissions Card */}
          <div className="card-mrv-metric p-5 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-amber-500/30 transition-all">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
              <span className="font-semibold flex items-center gap-1.5 text-amber-400">
                <Truck size={15} /> Transport Emissions
              </span>
              <span className="font-mono text-[10px] text-slate-500">Route-Allocated</span>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-200 tracking-tight">
              -{transportEmissions.toFixed(3)}
              <span className="text-xs font-normal text-slate-400 ml-1.5 font-sans">tCO₂e</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-2">
              Multi-stop CVRP route haulage emissions.
            </p>
          </div>

          {/* 3. Net Carbon Offset (Highlights Red if High Transport - Test Case 3) */}
          <div
            className={`card-mrv-metric p-5 rounded-2xl border transition-all ${
              isNetNegative
                ? 'bg-red-950/40 border-red-500/60 shadow-lg shadow-red-950/40 ring-1 ring-red-500/30'
                : 'bg-emerald-950/30 border-emerald-500/40 shadow-lg shadow-emerald-950/30'
            }`}
          >
            <div className="flex items-center justify-between text-xs mb-2">
              <span
                className={`font-bold flex items-center gap-1.5 ${
                  isNetNegative ? 'text-red-400' : 'text-emerald-400'
                }`}
              >
                {isNetNegative ? <TrendingDown size={15} /> : <TrendingUp size={15} />}
                Net Carbon Benefit
              </span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  isNetNegative
                    ? 'bg-red-900/80 text-red-200 border border-red-700/50'
                    : 'bg-emerald-900/80 text-emerald-200 border border-emerald-700/50'
                }`}
              >
                {isNetNegative ? 'DEFICIT' : 'NET OFFSET'}
              </span>
            </div>

            <div
              className={`text-3xl sm:text-4xl font-black tracking-tight ${
                isNetNegative ? 'text-red-400' : 'text-emerald-300'
              }`}
            >
              {formatTonne(netCarbonOffset)}
              <span className="text-sm font-normal text-slate-400 ml-1.5 font-sans">tCO₂e</span>
            </div>

            <p className={`text-[11px] mt-2 ${isNetNegative ? 'text-red-300/80' : 'text-slate-400'}`}>
              {isNetNegative
                ? 'Negative climate outcome: haulage exceeded avoided carbon.'
                : 'Net verifiable climate impact ready for ESG reporting.'}
            </p>
          </div>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* TEST CASE 2: READ-ONLY AUDIT & PROVENANCE METADATA TABLE      */}
        {/* ------------------------------------------------------------- */}
        <div className="mt-6 p-5 rounded-2xl bg-slate-900/80 border border-slate-800">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800 text-xs text-slate-300 font-semibold">
            <span className="flex items-center gap-2">
              <Lock size={14} className="text-slate-400" />
              <span>Immutable Chain of Custody (Read-Only)</span>
            </span>
            <span className="text-[11px] text-emerald-400 font-mono">
              STATUS: FINALIZED & LOCKED
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-y-3.5 gap-x-6 text-xs">
            {/* Batch ID */}
            <div>
              <span className="text-slate-400 block text-[11px]">Processing Batch ID</span>
              <strong className="font-mono text-white text-sm select-all">{batchId}</strong>
            </div>

            {/* Facility Name */}
            <div>
              <span className="text-slate-400 block text-[11px]">Destination Facility</span>
              <strong className="text-slate-200 text-sm">{facilityName}</strong>
            </div>

            {/* Waste Diverted */}
            <div>
              <span className="text-slate-400 block text-[11px]">Total Biomass Diverted</span>
              <strong className="text-slate-200 text-sm">{wasteTonnageDiverted} Tonnes</strong>
            </div>

            {/* Waste Type */}
            <div>
              <span className="text-slate-400 block text-[11px]">Waste Classification</span>
              <span className="text-slate-300 font-medium">{wasteType}</span>
            </div>

            {/* Processing Method */}
            <div>
              <span className="text-slate-400 block text-[11px]">Conversion Technology</span>
              <span className="text-purple-300 font-medium">{processingMethod}</span>
            </div>

            {/* Issuance Date */}
            <div>
              <span className="text-slate-400 block text-[11px]">Timestamp of Finalization</span>
              <span className="text-slate-300 font-mono text-[11px]">{formattedIssuedDate}</span>
            </div>
          </div>

          {/* Cryptographic Proof Hash */}
          <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-[11px]">
            <div className="flex items-center gap-2 text-slate-400">
              <Hash size={13} className="text-cyan-400" />
              <span>Audit Signature Hash:</span>
              <code className="px-2 py-0.5 rounded bg-slate-950 text-cyan-300 font-mono select-all text-[10px]">
                {auditHash}
              </code>
            </div>

            {generatorIds && generatorIds.length > 0 && (
              <div className="text-slate-400">
                <span>Source Lots: </span>
                <span className="text-slate-200 font-mono">{generatorIds.join(', ')}</span>
              </div>
            )}
          </div>
        </div>

        {/* Certificate Actions & Verification Seal Footer */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-slate-400 text-[11px]">
            <FileCheck2 size={15} className="text-emerald-400" />
            <span>Digitally sealed by EcoSync Carbon Accounting Engine • Tamper-Evident</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1.5 font-medium transition"
            >
              <Download size={13} />
              <span>Export PDF</span>
            </button>

            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(window.location.href);
                alert('Certificate verification link copied to clipboard!');
              }}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold flex items-center gap-1.5 transition shadow-lg shadow-emerald-600/20"
            >
              <Share2 size={13} />
              <span>Share Audit Link</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
