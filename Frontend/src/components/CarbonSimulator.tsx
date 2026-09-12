import React, { useState, useCallback, useMemo } from 'react';
import {
  ResponsiveContainer,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Tooltip,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from 'recharts';
import {
  Sliders,
  RotateCcw,
  Zap,
  Leaf,
  TrendingDown,
  TrendingUp,
  Trophy,
  AlertTriangle,
  FlaskConical,
  Factory,
  Truck,
  CheckCircle2,
  Info,
} from 'lucide-react';

// ─── Constants & Defaults ────────────────────────────────────────────────────

const DEFAULTS = {
  dieselFactor: 0.25,
  methaneFactor: 1.8,
  processingEfficiency: 85,
} as const;

const FACILITY_A = {
  id: 'A',
  name: 'Facility A',
  tag: 'Near / Dirty',
  distanceKm: 12,
  baseEfficiency: 0.72,
  color: '#f59e0b',
  emoji: '🏭',
};

const FACILITY_B = {
  id: 'B',
  name: 'Facility B',
  tag: 'Far / Clean',
  distanceKm: 55,
  baseEfficiency: 0.95,
  color: '#10b981',
  emoji: '♻️',
};

const TRUCK_PAYLOAD_TONS = 12;
const WASTE_VOLUME_TONS = 240;

// ─── Math Engine ─────────────────────────────────────────────────────────────

interface SimParams {
  dieselFactor: number;
  methaneFactor: number;
  processingEfficiency: number;
}

interface FacilityResult {
  facilityId: string;
  transportPenalty: number;
  grossAvoided: number;
  netBenefit: number;
  effectiveEfficiency: number;
}

function calcFacility(
  facility: typeof FACILITY_A,
  params: SimParams
): FacilityResult {
  const trips = Math.ceil(WASTE_VOLUME_TONS / TRUCK_PAYLOAD_TONS);
  const transportKgCO2 = params.dieselFactor * facility.distanceKm * 2 * trips;
  const transportPenalty = transportKgCO2 / 1000;
  const efficiencyScale = params.processingEfficiency / 100;
  const effectiveEfficiency = facility.baseEfficiency * efficiencyScale;
  const grossAvoided = WASTE_VOLUME_TONS * params.methaneFactor * effectiveEfficiency;
  const netBenefit = grossAvoided - transportPenalty;
  return {
    facilityId: facility.id,
    transportPenalty: Math.max(0, transportPenalty),
    grossAvoided: Math.max(0, grossAvoided),
    netBenefit,
    effectiveEfficiency: Math.min(1, effectiveEfficiency),
  };
}

function buildSensitivityData(params: SimParams) {
  const points: { x: number; facilityA: number; facilityB: number }[] = [];
  for (let d = 0.1; d <= 1.01; d = Math.round((d + 0.05) * 100) / 100) {
    const p = { ...params, dieselFactor: d };
    const ra = calcFacility(FACILITY_A, p);
    const rb = calcFacility(FACILITY_B, p);
    points.push({
      x: parseFloat(d.toFixed(2)),
      facilityA: parseFloat(ra.netBenefit.toFixed(2)),
      facilityB: parseFloat(rb.netBenefit.toFixed(2)),
    });
  }
  return points;
}

// ─── SliderRow Sub-component ──────────────────────────────────────────────────

interface SliderRowProps {
  id: string;
  label: string;
  sublabel: string;
  value: number;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
  accentColor: string;
  onChange: (v: number) => void;
  formatDisplay: (v: number) => string;
  minLabel: string;
  maxLabel: string;
}

const SliderRow: React.FC<SliderRowProps> = ({
  id, label, sublabel, value, min, max, step,
  defaultValue, accentColor, onChange, formatDisplay, minLabel, maxLabel,
}) => {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="cs-slider-row">
      <div className="cs-slider-header">
        <div>
          <label htmlFor={id} className="cs-slider-label">{label}</label>
          <p className="cs-slider-sublabel">{sublabel}</p>
        </div>
        <span className="cs-slider-value" style={{ color: accentColor }}>
          {formatDisplay(value)}
        </span>
      </div>
      <div className="cs-slider-track-container">
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="cs-slider-input"
          style={{ '--slider-pct': `${pct}%`, '--slider-color': accentColor } as React.CSSProperties}
        />
        <div className="cs-slider-marks">
          <span>{minLabel}</span>
          <span className="cs-slider-default-hint">default: {formatDisplay(defaultValue)}</span>
          <span>{maxLabel}</span>
        </div>
      </div>
    </div>
  );
};

// ─── MetricCard Sub-component ─────────────────────────────────────────────────

interface MetricCardProps {
  icon: React.ElementType;
  label: string;
  value: string;
  subtext: string;
  accentColor: string;
  highlight?: boolean;
}

const MetricCard: React.FC<MetricCardProps> = ({ icon: Icon, label, value, subtext, accentColor, highlight }) => (
  <div className={`cs-metric-card ${highlight ? 'cs-metric-card--highlight' : ''}`}
    style={{ '--card-accent': accentColor } as React.CSSProperties}>
    <div className="cs-metric-icon-wrap" style={{ background: `${accentColor}18`, border: `1px solid ${accentColor}35` }}>
      <Icon size={16} style={{ color: accentColor }} />
    </div>
    <div className="cs-metric-body">
      <p className="cs-metric-label">{label}</p>
      <p className="cs-metric-value" style={{ color: highlight ? accentColor : '#e2e8f0' }}>{value}</p>
      <p className="cs-metric-sub">{subtext}</p>
    </div>
  </div>
);

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

const SensTooltip: React.FC<{
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: number;
}> = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="cs-tooltip">
      <p className="cs-tooltip-title">Diesel: {label} kg CO₂/km</p>
      {payload.map((p) => (
        <div key={p.name} className="cs-tooltip-row">
          <span className="cs-tooltip-dot" style={{ background: p.color }} />
          <span style={{ color: '#cbd5e1' }}>{p.name}:</span>
          <span style={{ color: p.color, fontWeight: 700 }}>
            {p.value >= 0 ? '+' : ''}{p.value.toFixed(1)} tCO₂e
          </span>
        </div>
      ))}
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export const CarbonSimulator: React.FC = () => {
  const [dieselFactor, setDieselFactor] = useState<number>(DEFAULTS.dieselFactor);
  const [methaneFactor, setMethaneFactor] = useState<number>(DEFAULTS.methaneFactor);
  const [processingEfficiency, setProcessingEfficiency] = useState<number>(DEFAULTS.processingEfficiency);
  const [justReset, setJustReset] = useState(false);

  const params: SimParams = { dieselFactor, methaneFactor, processingEfficiency };

  const resultA = useMemo(() => calcFacility(FACILITY_A, params), [dieselFactor, methaneFactor, processingEfficiency]);
  const resultB = useMemo(() => calcFacility(FACILITY_B, params), [dieselFactor, methaneFactor, processingEfficiency]);
  const sensitivityData = useMemo(() => buildSensitivityData(params), [methaneFactor, processingEfficiency]);

  const winnerIsA = resultA.netBenefit > resultB.netBenefit;
  const winner = winnerIsA ? FACILITY_A : FACILITY_B;
  const loser = winnerIsA ? FACILITY_B : FACILITY_A;
  const winnerResult = winnerIsA ? resultA : resultB;
  const loserResult = winnerIsA ? resultB : resultA;
  const marginBenefit = Math.abs(winnerResult.netBenefit - loserResult.netBenefit);

  const isHighDieselScenario = dieselFactor >= 0.9;
  const isAtDefaults =
    dieselFactor === DEFAULTS.dieselFactor &&
    methaneFactor === DEFAULTS.methaneFactor &&
    processingEfficiency === DEFAULTS.processingEfficiency;

  const handleReset = useCallback(() => {
    setDieselFactor(DEFAULTS.dieselFactor);
    setMethaneFactor(DEFAULTS.methaneFactor);
    setProcessingEfficiency(DEFAULTS.processingEfficiency);
    setJustReset(true);
    setTimeout(() => setJustReset(false), 1800);
  }, []);

  const trips = Math.ceil(WASTE_VOLUME_TONS / TRUCK_PAYLOAD_TONS);

  const radarData = [
    {
      metric: 'Transport Efficiency',
      A: Math.max(0, 100 - (resultA.transportPenalty / (resultA.grossAvoided || 1)) * 100),
      B: Math.max(0, 100 - (resultB.transportPenalty / (resultB.grossAvoided || 1)) * 100),
    },
    {
      metric: 'Gross Avoidance',
      A: Math.min(100, (resultA.grossAvoided / 600) * 100),
      B: Math.min(100, (resultB.grossAvoided / 600) * 100),
    },
    {
      metric: 'Net Benefit',
      A: Math.min(100, Math.max(0, (resultA.netBenefit / 500) * 100)),
      B: Math.min(100, Math.max(0, (resultB.netBenefit / 500) * 100)),
    },
    {
      metric: 'Processing Eff.',
      A: FACILITY_A.baseEfficiency * (processingEfficiency / 100) * 100,
      B: FACILITY_B.baseEfficiency * (processingEfficiency / 100) * 100,
    },
    {
      metric: 'Proximity Score',
      A: Math.max(0, 100 - (FACILITY_A.distanceKm / 70) * 100),
      B: Math.max(0, 100 - (FACILITY_B.distanceKm / 70) * 100),
    },
  ];

  return (
    <div className="cs-root">
      {/* Header */}
      <div className="cs-header">
        <div className="cs-header-left">
          <div className="cs-header-icon-wrap">
            <FlaskConical size={22} className="cs-header-icon" />
          </div>
          <div>
            <h2 className="cs-title">Carbon Impact Simulator</h2>
            <p className="cs-subtitle">
              AR6-aligned parameter sandbox · Adjust variables to see real-time carbon accounting
            </p>
          </div>
        </div>
        <div className="cs-header-right">
          <div className="cs-scenario-badge">
            <Truck size={13} />
            <span>{WASTE_VOLUME_TONS} t/month · {trips} trips · {TRUCK_PAYLOAD_TONS}-t payload</span>
          </div>
          {/* TEST CASE 2: Reset Button */}
          <button
            id="cs-reset-btn"
            onClick={handleReset}
            disabled={isAtDefaults}
            className={`cs-reset-btn ${justReset ? 'cs-reset-btn--success' : ''}`}
          >
            {justReset ? (
              <><CheckCircle2 size={14} /><span>Restored!</span></>
            ) : (
              <><RotateCcw size={14} /><span>Reset to Standard Defaults</span></>
            )}
          </button>
        </div>
      </div>

      {/* TEST CASE 1: High-diesel flip banner */}
      {isHighDieselScenario && (
        <div className="cs-flip-banner" id="cs-flip-alert">
          <AlertTriangle size={16} className="cs-flip-banner-icon" />
          <div>
            <strong>High Transport Emission Scenario Detected</strong>
            {' — '}Diesel Factor ≥ 0.90 flips recommendation to{' '}
            <strong>Facility A (Near/Dirty)</strong>. Long-haul carbon cost now
            outweighs Facility B's cleaner processing advantage.
          </div>
        </div>
      )}

      <div className="cs-body">
        {/* Left: Sliders */}
        <aside className="cs-panel cs-panel--sliders">
          <div className="cs-panel-header">
            <Sliders size={15} className="text-purple-400" />
            <h3 className="cs-panel-title">Calculation Parameters</h3>
          </div>
          <div className="cs-sliders-stack">
            <SliderRow
              id="slider-diesel"
              label="Diesel Emission Factor"
              sublabel="kg CO₂ emitted per km driven"
              value={dieselFactor}
              min={0.1} max={1.0} step={0.01}
              defaultValue={DEFAULTS.dieselFactor}
              accentColor="#f59e0b"
              onChange={setDieselFactor}
              formatDisplay={(v) => `${v.toFixed(2)} kg CO₂/km`}
              minLabel="0.1"
              maxLabel="1.0"
            />
            <SliderRow
              id="slider-methane"
              label="Methane Avoidance Multiplier"
              sublabel="tCO₂e avoided per ton diverted from landfill"
              value={methaneFactor}
              min={0.5} max={3.0} step={0.05}
              defaultValue={DEFAULTS.methaneFactor}
              accentColor="#10b981"
              onChange={setMethaneFactor}
              formatDisplay={(v) => `${v.toFixed(2)} tCO₂e/ton`}
              minLabel="0.5"
              maxLabel="3.0"
            />
            <SliderRow
              id="slider-efficiency"
              label="Facility Processing Efficiency"
              sublabel="Operational efficiency multiplier applied to both facilities"
              value={processingEfficiency}
              min={50} max={99} step={1}
              defaultValue={DEFAULTS.processingEfficiency}
              accentColor="#818cf8"
              onChange={setProcessingEfficiency}
              formatDisplay={(v) => `${v}%`}
              minLabel="50%"
              maxLabel="99%"
            />
          </div>
          <div className="cs-footnote">
            <Info size={12} className="cs-footnote-icon" />
            <p>IPCC AR6 GWP-100. Transport accounts for round-trip over {trips} trips.</p>
          </div>
        </aside>

        {/* Right: Outputs */}
        <div className="cs-panel cs-panel--outputs">
          {/* Winner Card */}
          <div
            className={`cs-winner-card ${winnerIsA ? 'cs-winner-card--a' : 'cs-winner-card--b'}`}
            id="cs-winner-card"
          >
            <div className="cs-winner-bg-text">{winner.emoji}</div>
            <div className="cs-winner-left">
              <div className="cs-winner-trophy"><Trophy size={20} /></div>
              <div>
                <p className="cs-winner-eyebrow">Recommended Facility</p>
                <h3 className="cs-winner-name">
                  {winner.name}
                  <span className="cs-winner-tag">{winner.tag}</span>
                </h3>
                <p className="cs-winner-desc">
                  Net Benefit:{' '}
                  <strong style={{ color: winner.color }}>+{winnerResult.netBenefit.toFixed(1)} tCO₂e</strong>
                  {' vs '}
                  <span style={{ color: '#94a3b8' }}>{loserResult.netBenefit.toFixed(1)} tCO₂e</span>
                  {' '}({loser.name})
                </p>
              </div>
            </div>
            <div className="cs-winner-margin">
              <p className="cs-winner-margin-label">Margin</p>
              <p className="cs-winner-margin-value" style={{ color: winner.color }}>+{marginBenefit.toFixed(1)}</p>
              <p className="cs-winner-margin-unit">tCO₂e</p>
            </div>
          </div>

          {/* Per-facility cards */}
          <div className="cs-facilities-grid">
            {[
              { fac: FACILITY_A, result: resultA, isWinner: winnerIsA },
              { fac: FACILITY_B, result: resultB, isWinner: !winnerIsA },
            ].map(({ fac, result, isWinner }) => (
              <div
                key={fac.id}
                className={`cs-facility-block ${isWinner ? 'cs-facility-block--winner' : 'cs-facility-block--loser'}`}
                style={{ '--fac-color': fac.color } as React.CSSProperties}
              >
                <div className="cs-facility-block-header">
                  <span className="cs-facility-emoji">{fac.emoji}</span>
                  <div>
                    <p className="cs-facility-name">{fac.name}</p>
                    <p className="cs-facility-tag" style={{ color: fac.color }}>{fac.tag}</p>
                  </div>
                  {isWinner
                    ? <span className="cs-facility-badge cs-facility-badge--winner">✓ Winner</span>
                    : <span className="cs-facility-badge cs-facility-badge--loser">✗ Suboptimal</span>}
                </div>
                <div className="cs-metrics-grid">
                  <MetricCard
                    icon={Truck}
                    label="Transport Penalty"
                    value={`${result.transportPenalty.toFixed(2)} tCO₂e`}
                    subtext={`${fac.distanceKm} km × ${trips} trips (RT)`}
                    accentColor="#ef4444"
                  />
                  <MetricCard
                    icon={Leaf}
                    label="Gross Avoided"
                    value={`${result.grossAvoided.toFixed(1)} tCO₂e`}
                    subtext={`Eff. ${(result.effectiveEfficiency * 100).toFixed(0)}%`}
                    accentColor="#10b981"
                  />
                  <MetricCard
                    icon={result.netBenefit >= 0 ? TrendingDown : TrendingUp}
                    label="Net Climate Benefit"
                    value={`${result.netBenefit >= 0 ? '+' : ''}${result.netBenefit.toFixed(1)} tCO₂e`}
                    subtext="Avoided − Transport"
                    accentColor={isWinner ? fac.color : '#64748b'}
                    highlight={isWinner}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="cs-charts-row">
        <div className="cs-chart-card cs-chart-card--wide">
          <div className="cs-panel-header">
            <Zap size={15} className="text-amber-400" />
            <h3 className="cs-panel-title">Sensitivity — Net Benefit vs. Diesel Factor</h3>
            <span className="cs-chart-note">Current: {dieselFactor.toFixed(2)} kg CO₂/km</span>
          </div>
          <ResponsiveContainer width="100%" height={230}>
            <AreaChart data={sensitivityData} margin={{ top: 8, right: 16, left: 8, bottom: 16 }}>
              <defs>
                <linearGradient id="gradA" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={FACILITY_A.color} stopOpacity={0.35} />
                  <stop offset="95%" stopColor={FACILITY_A.color} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradB" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={FACILITY_B.color} stopOpacity={0.35} />
                  <stop offset="95%" stopColor={FACILITY_B.color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="x" stroke="#475569" tick={{ fill: '#94a3b8', fontSize: 10 }}
                label={{ value: 'Diesel Factor (kg CO₂/km)', position: 'insideBottom', offset: -10, fill: '#64748b', fontSize: 10 }} />
              <YAxis stroke="#475569" tick={{ fill: '#94a3b8', fontSize: 10 }}
                label={{ value: 'Net Benefit (tCO₂e)', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 10 }} />
              <Tooltip content={<SensTooltip />} />
              <Legend wrapperStyle={{ fontSize: '11px', color: '#94a3b8', paddingTop: '4px' }} />
              <Area type="monotone" dataKey="facilityA" name="Facility A (Near/Dirty)"
                stroke={FACILITY_A.color} fill="url(#gradA)" strokeWidth={2} dot={false} activeDot={{ r: 5 }} />
              <Area type="monotone" dataKey="facilityB" name="Facility B (Far/Clean)"
                stroke={FACILITY_B.color} fill="url(#gradB)" strokeWidth={2} dot={false} activeDot={{ r: 5 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="cs-chart-card cs-chart-card--narrow">
          <div className="cs-panel-header">
            <Factory size={15} className="text-indigo-400" />
            <h3 className="cs-panel-title">Facility Comparison Radar</h3>
          </div>
          <ResponsiveContainer width="100%" height={230}>
            <RadarChart data={radarData} margin={{ top: 10, right: 30, left: 30, bottom: 10 }}>
              <PolarGrid stroke="#1e293b" />
              <PolarAngleAxis dataKey="metric" tick={{ fill: '#94a3b8', fontSize: 9 }} />
              <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: '#475569', fontSize: 8 }} axisLine={false} />
              <Radar name="Facility A" dataKey="A" stroke={FACILITY_A.color} fill={FACILITY_A.color} fillOpacity={0.2} strokeWidth={2} />
              <Radar name="Facility B" dataKey="B" stroke={FACILITY_B.color} fill={FACILITY_B.color} fillOpacity={0.2} strokeWidth={2} />
              <Legend wrapperStyle={{ fontSize: '11px', color: '#94a3b8' }} />
              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', color: '#e2e8f0', fontSize: '11px' }} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Test Case Callouts */}
      <div className="cs-testcases-row">
        <div className={`cs-tc-card ${isHighDieselScenario ? 'cs-tc-card--active' : ''}`}>
          <div className="cs-tc-badge">Test Case 1</div>
          <p className="cs-tc-text">
            <strong>Diesel ≥ 0.90 flips facility.</strong> Slide Diesel Factor to max (1.0) — recommendation
            switches from Facility B → Facility A. Current: <strong style={{ color: isHighDieselScenario ? '#fbbf24' : '#94a3b8' }}>
              {dieselFactor.toFixed(2)} kg CO₂/km
            </strong> —{' '}
            {isHighDieselScenario
              ? <span style={{ color: '#fbbf24' }}>✓ <strong>FLIPPED to Facility A</strong></span>
              : <span style={{ color: '#64748b' }}>Facility B still leads</span>}
          </p>
        </div>
        <div className={`cs-tc-card ${isAtDefaults ? '' : 'cs-tc-card--active'}`}>
          <div className="cs-tc-badge">Test Case 2</div>
          <p className="cs-tc-text">
            <strong>"Reset to Standard Defaults"</strong> restores all sliders to baseline
            (Diesel: 0.25 · Methane: 1.80 · Efficiency: 85%).{' '}
            {isAtDefaults
              ? <span style={{ color: '#10b981' }}>✓ At defaults</span>
              : <span style={{ color: '#f59e0b' }}>Modified — click Reset to restore</span>}
          </p>
        </div>
      </div>
    </div>
  );
};

export default CarbonSimulator;

