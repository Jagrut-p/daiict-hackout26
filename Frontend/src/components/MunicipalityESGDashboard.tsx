import React, { useState, useEffect } from 'react';
import { apiService, EsgAnalyticsResponse } from '../services/apiService';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  Leaf,
  TrendingDown,
  TrendingUp,
  Building2,
  Calendar,
  Download,
  TreePine,
  ShieldCheck,
  Zap,
  Car,
  Scale,
  Activity,
  Award,
  RefreshCw,
  Sparkles,
} from 'lucide-react';

// TEST CASE 1: Realistic 6-month historical ESG and carbon accounting mock dataset
export interface MonthlyEmissionsData {
  month: string;
  monthShort: string;
  standardRouting: number; // Emissions with Standard Routing (tCO2e) - Higher / Worse
  carbonAwareRouting: number; // Emissions with Carbon-Aware Routing (tCO2e) - Lower / Optimized
  carbonSaved: number; // Difference in tCO2e
  percentageReduction: number; // % avoided
  wasteProcessedTons: number; // Total waste tonnage
  totalMethaneAvoided: number; // Landfill methane diverted (tCO2e)
}

export const MONTHLY_ESG_DATA: MonthlyEmissionsData[] = [
  {
    month: 'April 2026',
    monthShort: 'Apr 26',
    standardRouting: 52.4,
    carbonAwareRouting: 31.8,
    carbonSaved: 20.6,
    percentageReduction: 39.3,
    wasteProcessedTons: 2240,
    totalMethaneAvoided: 248.5,
  },
  {
    month: 'May 2026',
    monthShort: 'May 26',
    standardRouting: 58.7,
    carbonAwareRouting: 34.2,
    carbonSaved: 24.5,
    percentageReduction: 41.7,
    wasteProcessedTons: 2410,
    totalMethaneAvoided: 268.2,
  },
  {
    month: 'June 2026',
    monthShort: 'Jun 26',
    standardRouting: 63.5,
    carbonAwareRouting: 37.1,
    carbonSaved: 26.4,
    percentageReduction: 41.6,
    wasteProcessedTons: 2680,
    totalMethaneAvoided: 295.4,
  },
  {
    month: 'July 2026',
    monthShort: 'Jul 26',
    standardRouting: 56.9,
    carbonAwareRouting: 33.4,
    carbonSaved: 23.5,
    percentageReduction: 41.3,
    wasteProcessedTons: 2390,
    totalMethaneAvoided: 262.1,
  },
  {
    month: 'August 2026',
    monthShort: 'Aug 26',
    standardRouting: 61.8,
    carbonAwareRouting: 36.5,
    carbonSaved: 25.3,
    percentageReduction: 40.9,
    wasteProcessedTons: 2550,
    totalMethaneAvoided: 284.0,
  },
  {
    month: 'September 2026 (MTD)',
    monthShort: 'Sep 26',
    standardRouting: 59.2,
    carbonAwareRouting: 34.8,
    carbonSaved: 24.4,
    percentageReduction: 41.2,
    wasteProcessedTons: 2550.5,
    totalMethaneAvoided: 284.6,
  },
];

// Waste category distribution dataset
const WASTE_STREAM_BREAKDOWN = [
  { name: 'APMC Wet & Organic Biomass', value: 54, color: '#10b981' },
  { name: 'Industrial & Chemical Residue', value: 22, color: '#06b6d4' },
  { name: 'Recyclables & Scrap Metals', value: 16, color: '#f59e0b' },
  { name: 'Hazardous Waste Stream', value: 8, color: '#f43f5e' },
];

// TEST CASE 2: Custom High-Fidelity Tooltip Component displaying exact values
interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    color: string;
    dataKey: string;
    payload: MonthlyEmissionsData;
  }>;
  label?: string;
}

const CoreThesisTooltip: React.FC<CustomTooltipProps> = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const stdValue = data.standardRouting;
    const optValue = data.carbonAwareRouting;
    const diff = Number((stdValue - optValue).toFixed(2));
    const pct = Number(((diff / stdValue) * 100).toFixed(1));

    return (
      <div className="bg-slate-950/95 border border-slate-700/80 rounded-xl p-4 shadow-2xl backdrop-blur-xl text-xs font-sans min-w-[260px] animate-fade-in z-50">
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
          <span className="font-bold text-white text-sm flex items-center gap-1.5">
            <Calendar size={14} className="text-cyan-400" />
            {data.month}
          </span>
          <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
            -{pct}% tCO₂e
          </span>
        </div>

        <div className="space-y-2 font-mono">
          {/* Standard Routing Value */}
          <div className="flex items-center justify-between">
            <span className="text-slate-400 flex items-center gap-1.5 font-sans">
              <span className="w-2.5 h-2.5 rounded-sm bg-rose-500/80" />
              Standard Routing:
            </span>
            <span className="font-bold text-rose-400 text-sm">
              {stdValue.toFixed(2)} <span className="text-[10px] font-normal text-slate-500">tCO₂e</span>
            </span>
          </div>

          {/* Carbon-Aware Routing Value */}
          <div className="flex items-center justify-between">
            <span className="text-slate-400 flex items-center gap-1.5 font-sans">
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-400" />
              Carbon-Aware Routing:
            </span>
            <span className="font-bold text-emerald-400 text-sm">
              {optValue.toFixed(2)} <span className="text-[10px] font-normal text-slate-500">tCO₂e</span>
            </span>
          </div>

          {/* Net Carbon Saved */}
          <div className="pt-2 mt-2 border-t border-slate-800/80 flex items-center justify-between">
            <span className="text-slate-300 font-bold font-sans flex items-center gap-1">
              <TrendingDown size={14} className="text-emerald-400" />
              Net Avoided Transport Emissions:
            </span>
            <span className="font-black text-white text-sm bg-emerald-500/20 px-2 py-0.5 rounded text-emerald-300">
              +{diff.toFixed(2)} tCO₂e
            </span>
          </div>

          {/* Additional Context */}
          <div className="pt-1 text-[10px] text-slate-400 font-sans flex justify-between">
            <span>Waste Processed:</span>
            <span className="text-slate-200 font-mono">{data.wasteProcessedTons.toLocaleString()} Tons</span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

export const MunicipalityESGDashboard: React.FC = () => {
  const [activeTimeframe, setActiveTimeframe] = useState<'6M' | '3M' | '1Y'>('6M');
  const [activeChartMode, setActiveChartMode] = useState<'grouped' | 'net_avoided'>('grouped');
  const [liveAnalytics, setLiveAnalytics] = useState<EsgAnalyticsResponse | null>(null);
  const [isLoadingLive, setIsLoadingLive] = useState<boolean>(false);

  const fetchLiveAnalytics = async () => {
    setIsLoadingLive(true);
    try {
      const res = await apiService.getEsgAnalytics();
      setLiveAnalytics(res);
    } catch {
      // Backend offline, fallback to historical dataset
    } finally {
      setIsLoadingLive(false);
    }
  };

  useEffect(() => {
    fetchLiveAnalytics();
  }, []);

  // Aggregated Summary Statistics calculated across dataset + live backend
  const baseWasteProcessed = MONTHLY_ESG_DATA.reduce(
    (acc, curr) => acc + curr.wasteProcessedTons,
    0
  );
  const totalWasteProcessed = liveAnalytics?.summary.total_diverted_tonnes ?? baseWasteProcessed;

  const totalCarbonAwareTransportEmissions = MONTHLY_ESG_DATA.reduce(
    (acc, curr) => acc + curr.carbonAwareRouting,
    0
  );

  const totalStandardTransportEmissions = MONTHLY_ESG_DATA.reduce(
    (acc, curr) => acc + curr.standardRouting,
    0
  );

  const totalMethaneAvoided = liveAnalytics?.summary.methane_abated_tonnes ?? MONTHLY_ESG_DATA.reduce(
    (acc, curr) => acc + curr.totalMethaneAvoided,
    0
  );

  // Net City Carbon Reduction = (Total Landfill Methane Avoided + Transport Fuel Savings)
  const transportSavings = totalStandardTransportEmissions - totalCarbonAwareTransportEmissions;
  const netCityCarbonReduction = liveAnalytics?.summary.total_net_co2e_avoided ?? (totalMethaneAvoided + transportSavings);

  return (
    <div className="w-full mx-auto space-y-8">
      {/* Top Municipal Executive Banner */}
      <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-3xl p-6 sm:p-7 shadow-xl backdrop-blur-xl relative overflow-hidden">
        {/* Hero-Style Ambient Aura Spotlights */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 left-1/3 w-60 h-60 bg-violet-500/5 rounded-full blur-2xl pointer-events-none" />
        {/* Specular Light Bar */}
        <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-indigo-400/40 to-transparent" />

        <div className="flex flex-col 2xl:flex-row 2xl:items-center justify-between gap-5 relative z-10">
          <div className="flex items-start sm:items-center gap-4">
            <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-indigo-500/20 via-violet-500/15 to-cyan-500/15 border border-indigo-400/25 flex items-center justify-center text-indigo-400 shadow-lg shadow-indigo-500/10 shrink-0">
              <Building2 size={26} />
            </div>
            <div>
              {/* Hero Eyebrow Tag */}
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-400/25 text-indigo-500 dark:text-indigo-300 text-[10px] font-mono font-semibold uppercase tracking-wider mb-1.5">
                <Sparkles size={11} />
                <span>Executive Climate Intelligence</span>
                <span className="w-1 h-1 rounded-full bg-indigo-400" />
                <span>IPCC AR6 Aligned</span>
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="text-xl sm:text-2xl font-black text-[var(--text-primary)] tracking-tight">
                  Gandhinagar Municipal Corporation
                </h2>
                <span className="px-3 py-1 rounded-lg text-xs font-mono font-semibold bg-indigo-500/15 text-indigo-500 dark:text-indigo-300 border border-indigo-400/25">
                  Tier A ESG Certified
                </span>
              </div>
              <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1">
                Executive Climate Intelligence &amp; Scope 1 / Scope 3 Waste Carbon Abatement Console
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {/* Timeframe selector */}
            <div className="flex items-center bg-slate-500/[0.08] p-1 rounded-2xl border border-[var(--border-color)] text-xs">
              {(['3M', '6M', '1Y'] as const).map((tf) => (
                <button
                  key={tf}
                  type="button"
                  onClick={() => setActiveTimeframe(tf)}
                  className={`px-3 py-1.5 rounded-xl font-semibold transition-all ${
                    activeTimeframe === tf
                      ? 'bg-indigo-500/20 text-indigo-500 dark:text-indigo-200 border border-indigo-400/30 shadow-sm'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={fetchLiveAnalytics}
              disabled={isLoadingLive}
              className="px-3.5 py-2 rounded-2xl bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-500 dark:text-indigo-200 text-xs font-semibold border border-indigo-400/30 transition-all flex items-center gap-2"
              title="Refresh live ESG stats from backend"
            >
              <RefreshCw size={13} className={isLoadingLive ? 'animate-spin' : ''} />
              <span>{isLoadingLive ? 'Syncing...' : 'Live Sync'}</span>
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              className="px-3.5 py-2 rounded-2xl bg-slate-500/10 hover:bg-slate-500/20 text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xs font-semibold border border-[var(--border-color)] transition-all flex items-center gap-2"
            >
              <Download size={13} />
              <span>Export Report</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3 LARGE SUMMARY STAT CARDS AT TOP - RESPONSIVE & SPACIOUS */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 lg:gap-7 mb-8 lg:mb-10">
        {/* Stat Card 1: Total Waste Processed (Tons) */}
        <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-6 sm:p-7 shadow-xl backdrop-blur-xl relative overflow-hidden group hover:border-cyan-400/40 transition-all duration-300">
          <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 rounded-full blur-2xl pointer-events-none" />
          {/* Specular Shimmer Top Accent Line */}
          <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent group-hover:via-cyan-400/80 transition-all duration-500" />

          <div className="flex items-center justify-between text-xs font-semibold text-[var(--text-muted)] mb-4 flex-wrap gap-2">
            <span className="flex items-center gap-2 uppercase tracking-wider text-[11px] text-cyan-500 dark:text-cyan-400 font-bold">
              <Scale size={16} className="text-cyan-500 dark:text-cyan-400 shrink-0" />
              Total Waste Processed
            </span>
            <span className="px-2.5 py-1 rounded-lg text-xs font-mono bg-cyan-500/10 text-cyan-600 dark:text-cyan-300 border border-cyan-500/20 font-semibold shadow-sm shrink-0">
              Last 6 Months
            </span>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl sm:text-4xl font-black font-mono text-[var(--text-primary)] tracking-tight">
                {totalWasteProcessed.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
              </span>
              <span className="text-base font-bold text-[var(--text-muted)] font-mono">Tons</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-emerald-500 dark:text-emerald-400 font-medium pt-0.5">
              <TrendingUp size={14} className="shrink-0" />
              <span>+14.8% YoY diversion volume from open dump</span>
            </div>
          </div>

          <div className="mt-5 pt-3.5 border-t border-[var(--border-color)] grid grid-cols-2 gap-2 text-[11px] text-[var(--text-muted)] font-mono">
            <div>
              <span className="text-[var(--text-muted)] block text-[10px]">AVG MONTHLY</span>
              <span className="text-[var(--text-primary)] font-semibold">
                {(totalWasteProcessed / 6).toFixed(1)} Tons/mo
              </span>
            </div>
            <div>
              <span className="text-[var(--text-muted)] block text-[10px]">RECOVERY RATE</span>
              <span className="text-emerald-500 dark:text-emerald-400 font-semibold">93.4% Recycled</span>
            </div>
          </div>
        </div>

        {/* Stat Card 2: Total Transport Emissions (tCO2e) */}
        <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-6 sm:p-7 shadow-xl backdrop-blur-xl relative overflow-hidden group hover:border-amber-400/40 transition-all duration-300">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />
          {/* Specular Shimmer Top Accent Line */}
          <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-amber-400/40 to-transparent group-hover:via-amber-400/80 transition-all duration-500" />

          <div className="flex items-center justify-between text-xs font-semibold text-[var(--text-muted)] mb-4 flex-wrap gap-2">
            <span className="flex items-center gap-2 uppercase tracking-wider text-[11px] text-amber-500 dark:text-amber-400 font-bold">
              <Car size={16} className="text-amber-500 dark:text-amber-400 shrink-0" />
              Total Transport Emissions
            </span>
            <span className="px-2.5 py-1 rounded-lg text-xs font-mono bg-amber-500/10 text-amber-600 dark:text-amber-300 border border-amber-500/20 font-semibold shadow-sm shrink-0">
              Scope 1 Logistics
            </span>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl sm:text-4xl font-black font-mono text-[var(--text-primary)] tracking-tight">
                {totalCarbonAwareTransportEmissions.toFixed(2)}
              </span>
              <span className="text-base font-bold text-[var(--text-muted)] font-mono">tCO₂e</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-emerald-500 dark:text-emerald-400 font-medium pt-0.5">
              <TrendingDown size={14} className="shrink-0" />
              <span>
                -{(totalStandardTransportEmissions - totalCarbonAwareTransportEmissions).toFixed(1)} tCO₂e (-41.1%) vs unoptimized
              </span>
            </div>
          </div>

          <div className="mt-5 pt-3.5 border-t border-[var(--border-color)] grid grid-cols-2 gap-2 text-[11px] text-[var(--text-muted)] font-mono">
            <div>
              <span className="text-[var(--text-muted)] block text-[10px]">UNOPTIMIZED</span>
              <span className="text-rose-500 dark:text-rose-400 line-through">
                {totalStandardTransportEmissions.toFixed(1)} tCO₂e
              </span>
            </div>
            <div>
              <span className="text-[var(--text-muted)] block text-[10px]">DIESEL AVOIDED</span>
              <span className="text-cyan-500 dark:text-cyan-400 font-semibold">~54,800 L</span>
            </div>
          </div>
        </div>

        {/* Stat Card 3: Refined Soft Impact Card - Net City Carbon Reduction (tCO2e) */}
        <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-6 sm:p-7 shadow-xl backdrop-blur-xl relative overflow-hidden group hover:border-indigo-400/40 transition-all duration-300">
          <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
          {/* Specular Shimmer Top Accent Line */}
          <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-emerald-400/40 to-transparent group-hover:via-emerald-400/80 transition-all duration-500" />

          <div className="flex items-center justify-between text-xs font-semibold text-[var(--text-muted)] mb-4 flex-wrap gap-2">
            <span className="flex items-center gap-2 uppercase tracking-wider text-[11px] text-indigo-500 dark:text-indigo-400 font-bold">
              <Leaf size={16} className="text-emerald-500 dark:text-emerald-400 shrink-0" />
              <span>Net City Carbon Reduction</span>
            </span>
            <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-indigo-500/15 text-indigo-500 dark:text-indigo-300 border border-indigo-400/25 shadow-sm shrink-0">
              KEY ESG IMPACT
            </span>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl sm:text-4xl font-black font-mono tracking-tight bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
                {netCityCarbonReduction.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
              </span>
              <span className="text-lg font-bold text-teal-400 font-mono">tCO₂e</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] font-medium pt-0.5">
              <TreePine size={14} className="text-emerald-400 shrink-0" />
              <span>Equivalent to ~42,300 mature urban trees</span>
            </div>
          </div>

          <div className="mt-5 pt-3.5 border-t border-[var(--border-color)] grid grid-cols-2 gap-2 text-[11px] text-[var(--text-muted)] font-mono">
            <div>
              <span className="text-[var(--text-muted)] block text-[10px]">LANDFILL DIVERSION</span>
              <strong className="text-emerald-400 font-semibold">{totalMethaneAvoided.toFixed(1)} tCO₂e</strong>
            </div>
            <div>
              <span className="text-[var(--text-muted)] block text-[10px]">ROUTE OPTIMIZATION</span>
              <strong className="text-cyan-400 font-semibold">{transportSavings.toFixed(1)} tCO₂e</strong>
            </div>
          </div>
        </div>
      </div>

      {/* CORE THESIS CHART: 6-Month Comparative Bar Chart */}
      <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-3xl p-6 sm:p-8 shadow-xl backdrop-blur-xl space-y-6">
        <div className="flex flex-col 2xl:flex-row 2xl:items-center justify-between gap-4 pb-4 border-b border-[var(--border-color)]">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-indigo-500/15 text-indigo-400 border border-indigo-400/20">
                <Activity size={20} />
              </div>
              <h3 className="text-base sm:text-lg font-bold text-[var(--text-primary)] tracking-tight">
                Core Thesis: Routing Optimization Carbon Abatement (Last 6 Months)
              </h3>
            </div>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              Comparative analysis evaluating monthly fleet logistics emissions: Standard legacy routing versus AI Carbon-Aware dynamic dispatch.
            </p>
          </div>

          {/* Chart View Mode Controls */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setActiveChartMode('grouped')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                activeChartMode === 'grouped'
                  ? 'bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-500/25'
                  : 'bg-slate-500/10 hover:bg-slate-500/20 text-[var(--text-secondary)] border border-[var(--border-color)]'
              }`}
            >
              Side-by-Side Comparison
            </button>
            <button
              type="button"
              onClick={() => setActiveChartMode('net_avoided')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                activeChartMode === 'net_avoided'
                  ? 'bg-gradient-to-r from-sky-500 to-indigo-600 text-white shadow-md shadow-sky-500/25'
                  : 'bg-slate-500/10 hover:bg-slate-500/20 text-[var(--text-secondary)] border border-[var(--border-color)]'
              }`}
            >
              Net Carbon Avoided
            </button>
          </div>
        </div>

        {/* Legend strip */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs bg-[var(--bg-surface)] p-3 rounded-xl border border-[var(--border-color)]">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-sm bg-rose-500/90 shadow-sm" />
              <span className="font-semibold text-slate-200">Emissions with Standard Routing</span>
              <span className="text-[11px] text-slate-500">(Legacy GPS shortest path)</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-sm bg-emerald-400 shadow-sm" />
              <span className="font-semibold text-emerald-300">Emissions with Carbon-Aware Routing</span>
              <span className="text-[11px] text-emerald-500/80">(EcoSync Optimized)</span>
            </div>
          </div>

          <div className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/30">
            Average Reduction: <strong>~41.0% tCO₂e / Month</strong>
          </div>
        </div>

        {/* Recharts BarChart Container */}
        <div className="h-[360px] w-full pt-4">
          <ResponsiveContainer width="100%" height="100%">
            {activeChartMode === 'grouped' ? (
              <BarChart
                data={MONTHLY_ESG_DATA}
                margin={{ top: 20, right: 30, left: 10, bottom: 10 }}
                barGap={8}
                barCategoryGap="25%"
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis
                  dataKey="monthShort"
                  stroke="#64748b"
                  fontSize={12}
                  tickLine={false}
                  axisLine={{ stroke: '#334155' }}
                />
                <YAxis
                  stroke="#64748b"
                  fontSize={12}
                  tickLine={false}
                  axisLine={{ stroke: '#334155' }}
                  tickFormatter={(val) => `${val} t`}
                  domain={[0, 75]}
                />
                <Tooltip content={<CoreThesisTooltip />} cursor={{ fill: 'rgba(255, 255, 255, 0.04)' }} />
                <Legend
                  verticalAlign="top"
                  align="right"
                  wrapperStyle={{ paddingBottom: '10px', fontSize: '12px' }}
                />
                <Bar
                  dataKey="standardRouting"
                  name="Emissions with Standard Routing (tCO₂e)"
                  fill="#f43f5e"
                  radius={[6, 6, 0, 0]}
                  animationDuration={1200}
                />
                <Bar
                  dataKey="carbonAwareRouting"
                  name="Emissions with Carbon-Aware Routing (tCO₂e)"
                  fill="#10b981"
                  radius={[6, 6, 0, 0]}
                  animationDuration={1200}
                />
              </BarChart>
            ) : (
              <AreaChart
                data={MONTHLY_ESG_DATA}
                margin={{ top: 20, right: 30, left: 10, bottom: 10 }}
              >
                <defs>
                  <linearGradient id="colorAvoided" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis
                  dataKey="monthShort"
                  stroke="#64748b"
                  fontSize={12}
                  tickLine={false}
                  axisLine={{ stroke: '#334155' }}
                />
                <YAxis
                  stroke="#64748b"
                  fontSize={12}
                  tickLine={false}
                  axisLine={{ stroke: '#334155' }}
                  tickFormatter={(val) => `${val} t`}
                />
                <Tooltip content={<CoreThesisTooltip />} />
                <Area
                  type="monotone"
                  dataKey="carbonSaved"
                  name="Net Carbon Avoided (tCO₂e)"
                  stroke="#10b981"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorAvoided)"
                />
              </AreaChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>

      {/* Secondary ESG Breakdown Grid: Stream Breakdown & Municipal SDGs */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-7">
        {/* Stream Breakdown Chart with Tight Graph-to-Legend Distance */}
        <div className="xl:col-span-6 min-w-0 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-6 sm:p-7 shadow-xl backdrop-blur-md space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-[var(--border-color)]">
            <h4 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
              <Zap size={16} className="text-amber-400" />
              Municipal Waste Diversion Stream Breakdown
            </h4>
            <span className="text-[11px] font-mono text-[var(--text-muted)] bg-slate-500/10 px-2 py-0.5 rounded border border-[var(--border-color)]">
              Total: 100%
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-start gap-4 sm:gap-6 pt-1">
            {/* Donut Chart with Constrained Footprint */}
            <div className="w-[160px] h-[160px] shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={WASTE_STREAM_BREAKDOWN}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={44}
                    outerRadius={74}
                    paddingAngle={3}
                  >
                    {WASTE_STREAM_BREAKDOWN.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} stroke="var(--bg-card)" strokeWidth={2} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Adjacent Stream Descriptions & Metrics */}
            <div className="flex-1 min-w-0 space-y-2 text-xs w-full">
              {WASTE_STREAM_BREAKDOWN.map((stream) => (
                <div
                  key={stream.name}
                  className="flex items-center justify-between gap-2.5 p-2 rounded-xl bg-slate-500/[0.04] hover:bg-slate-500/[0.08] border border-[var(--border-color)]/60 transition-colors"
                >
                  <span className="flex items-center gap-2 text-[var(--text-secondary)] min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm"
                      style={{ backgroundColor: stream.color }}
                    />
                    <span className="font-semibold text-[var(--text-primary)] truncate text-xs" title={stream.name}>
                      {stream.name}
                    </span>
                  </span>
                  <span className="font-mono font-bold text-xs text-[var(--text-primary)] shrink-0 px-2 py-0.5 rounded-md bg-slate-500/15 border border-[var(--border-color)]">
                    {stream.value}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Municipal Policy Compliance & UN SDGs Card */}
        <div className="xl:col-span-6 min-w-0 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-6 sm:p-7 shadow-xl backdrop-blur-md space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-[var(--border-color)]">
            <h4 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
              <Award size={16} className="text-emerald-400" />
              UN Sustainable Development Goals (SDG) Alignment
            </h4>
            <span className="text-[11px] font-mono text-emerald-500 dark:text-emerald-400 font-semibold bg-emerald-500/10 px-2.5 py-0.5 rounded-md border border-emerald-500/25">
              Verified
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl p-3 text-center space-y-1 shadow-sm">
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-500 dark:text-amber-400 font-black font-mono text-xs flex items-center justify-center mx-auto">
                11
              </div>
              <span className="text-xs font-bold text-[var(--text-primary)] block">Sustainable Cities</span>
              <p className="text-[10px] text-[var(--text-muted)]">Zero open dumping</p>
            </div>

            <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl p-3.5 text-center space-y-1.5 shadow-sm">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-500 dark:text-emerald-400 font-black font-mono text-xs flex items-center justify-center mx-auto">
                12
              </div>
              <span className="text-xs font-bold text-[var(--text-primary)] block">Responsible Action</span>
              <p className="text-[10px] text-[var(--text-muted)]">Circular bioeconomy</p>
            </div>

            <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl p-3.5 text-center space-y-1.5 shadow-sm">
              <div className="w-8 h-8 rounded-lg bg-cyan-500/20 text-cyan-500 dark:text-cyan-400 font-black font-mono text-xs flex items-center justify-center mx-auto">
                13
              </div>
              <span className="text-xs font-bold text-[var(--text-primary)] block">Climate Action</span>
              <p className="text-[10px] text-[var(--text-muted)]">Scope 1 & 3 abatement</p>
            </div>
          </div>

          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl p-3.5 flex items-center justify-between text-xs">
            <span className="text-[var(--text-secondary)] flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-emerald-400" />
              Third-Party Carbon Accounting Standard:
            </span>
            <span className="font-mono font-bold text-[var(--text-primary)]">ISO 14064-1 / GHG Protocol</span>
          </div>
        </div>
      </div>
    </div>
  );
};
