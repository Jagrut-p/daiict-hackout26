import React, { useState, useEffect, useRef } from 'react';
import { AppLayout } from './components/AppLayout';
import { WasteCollectionForm } from './components/WasteCollectionForm';
import { QueueViewer } from './components/QueueViewer';
import { ShipmentAuditLog } from './components/ShipmentAuditLog';

import { GisRouteViewer } from './components/GisRouteViewer';
import { CarbonSimulator } from './components/CarbonSimulator';
import { FacilityIntakeTerminal } from './components/FacilityIntakeTerminal';
import { ShipmentAuditLedger } from './components/ShipmentAuditLedger';
import { MunicipalityESGDashboard } from './components/MunicipalityESGDashboard';
import {
  ArrowDown,
  Leaf,
  Zap,
  Shield,
  Sparkles,
  MapPin,
  BarChart3,
  ChevronRight,
  Activity,
  Layers,
} from 'lucide-react';

/* ── Scroll-reveal Hook with Stagger Support ── */
function useScrollReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          obs.unobserve(el);
        }
      },
      { threshold: 0.08, rootMargin: '0px 0px -40px 0px' }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return { ref, visible };
}

const RevealSection: React.FC<{
  children: React.ReactNode;
  className?: string;
  delay?: number;
}> = ({ children, className = '', delay = 0 }) => {
  const { ref, visible } = useScrollReveal();
  return (
    <div
      ref={ref}
      className={`${className} w-full min-w-0 transition-all duration-700 ease-out`}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0) scale(1)' : 'translateY(28px) scale(0.99)',
        transitionDelay: `${delay}ms`,
      }}
    >
      {children}
    </div>
  );
};

/* ── Apple & Samsung Style Hero Landing Section ── */
interface HeroSectionProps {
  onExplore: (tabId?: string) => void;
  onCollapseToggle?: () => void;
  isCollapsed?: boolean;
}

const HeroSection: React.FC<HeroSectionProps> = ({ onExplore }) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 60);
    return () => clearTimeout(t);
  }, []);

  return (
    <section className="hero-apple-stage">
      {/* Ambient background light halos */}
      <div className="hero-radial-spotlight hero-radial-1" />
      <div className="hero-radial-spotlight hero-radial-2" />
      <div className="hero-radial-spotlight hero-radial-3" />

      {/* Futuristic orbital light rings in 3D perspective */}
      <div className="hero-orbital-wrapper">
        <div className="hero-orbital-ring ring-outer" />
        <div className="hero-orbital-ring ring-middle" />
        <div className="hero-orbital-ring ring-inner" />
      </div>

      {/* Subtle digital grid backdrop */}
      <div className="hero-mesh-grid" />

      <div
        className="hero-apple-container"
        style={{
          opacity: mounted ? 1 : 0,
          transform: mounted ? 'translateY(0)' : 'translateY(36px)',
          transition: 'opacity 1s cubic-bezier(0.16, 1, 0.3, 1), transform 1s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Top Eyebrow Tag */}
        <div className="hero-top-eyebrow">
          <span className="hero-eyebrow-dot" />
          <Sparkles size={13} className="text-indigo-400" />
          <span className="tracking-widest uppercase text-[11px] font-semibold text-indigo-200/90">
            Municipal Climate Intelligence & Circular Symbiosis
          </span>
          <span className="hero-eyebrow-pill">v2.4 Live</span>
        </div>

        {/* Centerpiece Grand Title with Apple/Samsung Continuous Specular Shimmer */}
        <div className="hero-title-wrapper">
          <div className="hero-title-ambient-aura" />
          <h1 className="hero-main-title">
            <span className="hero-title-shimmer">CarbonRoute</span>
            <span className="hero-title-badge">MRV</span>
          </h1>
          {/* Animated specular light sweep overlay */}
          <div className="hero-light-sweep-bar" />
        </div>

        {/* Subtitle & Value Proposition */}
        <p className="hero-lead-description">
          Verified industrial waste-to-carbon traceability powered by carbon-minimized GIS routing,
          offline-first cryptographically sealed ledger, and automated IPCC AR6 compliance certification.
        </p>

        {/* 4 Apple-Style Floating Metric Cards */}
        <div className="hero-metrics-grid">
          <div className="hero-metric-card group">
            <div className="hero-metric-icon bg-indigo-500/15 text-indigo-300 border-indigo-400/20">
              <Zap size={16} />
            </div>
            <div className="hero-metric-info">
              <div className="hero-metric-number">99.8%</div>
              <div className="hero-metric-label">Sync Integrity</div>
              <div className="hero-metric-sub">Zero-loss IndexedDB offline queue</div>
            </div>
          </div>

          <div className="hero-metric-card group">
            <div className="hero-metric-icon bg-emerald-500/15 text-emerald-300 border-emerald-400/20">
              <Leaf size={16} />
            </div>
            <div className="hero-metric-info">
              <div className="hero-metric-number">42.8 tCO₂e</div>
              <div className="hero-metric-label">Carbon Abated</div>
              <div className="hero-metric-sub">Verified landfill diversion</div>
            </div>
          </div>

          <div className="hero-metric-card group">
            <div className="hero-metric-icon bg-sky-500/15 text-sky-300 border-sky-400/20">
              <MapPin size={16} />
            </div>
            <div className="hero-metric-info">
              <div className="hero-metric-number">&lt; 0.4s</div>
              <div className="hero-metric-label">GIS Optimization</div>
              <div className="hero-metric-sub">Live low-emission dispatch matrix</div>
            </div>
          </div>

          <div className="hero-metric-card group">
            <div className="hero-metric-icon bg-purple-500/15 text-purple-300 border-purple-400/20">
              <Shield size={16} />
            </div>
            <div className="hero-metric-info">
              <div className="hero-metric-number">ISO 14064</div>
              <div className="hero-metric-label">MRV Sealed</div>
              <div className="hero-metric-sub">SHA-256 tamper-evident ledger</div>
            </div>
          </div>
        </div>

        {/* Dual Primary & Secondary Action Controls */}
        <div className="hero-action-buttons">
          <button
            type="button"
            onClick={() => onExplore()}
            className="hero-primary-btn"
          >
            <Activity size={18} />
            <span>Launch Climate Console</span>
            <ChevronRight size={16} className="hero-btn-arrow" />
          </button>

          <div className="hero-quick-modules">
            <button
              type="button"
              onClick={() => onExplore('gis')}
              className="hero-pill-btn"
            >
              <MapPin size={13} className="text-sky-400" />
              <span>Route GIS</span>
            </button>
            <button
              type="button"
              onClick={() => onExplore('form')}
              className="hero-pill-btn"
            >
              <Layers size={13} className="text-indigo-400" />
              <span>Manifest Entry</span>
            </button>
            <button
              type="button"
              onClick={() => onExplore('esg')}
              className="hero-pill-btn"
            >
              <BarChart3 size={13} className="text-purple-400" />
              <span>ESG Dashboard</span>
            </button>
          </div>
        </div>

        {/* Apple-Style Bottom Scroll Prompt */}
        <div
          onClick={() => onExplore()}
          className="hero-scroll-cue cursor-pointer"
          title="Click or scroll to explore console"
        >
          <div className="hero-mouse-pill">
            <span className="hero-mouse-wheel" />
          </div>
          <span className="text-[11px] font-mono tracking-widest text-slate-400 uppercase">
            Scroll to explore platform
          </span>
          <ArrowDown size={14} className="hero-arrow-bounce text-slate-500" />
        </div>
      </div>
    </section>
  );
};

/* ── Main App Controller ── */
export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('esg');
  const dashboardRef = useRef<HTMLDivElement>(null);

  const handleExplore = (tabId?: string) => {
    if (tabId) {
      setActiveTab(tabId);
    }
    dashboardRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen w-full bg-[var(--bg-main)] text-[var(--text-primary)] selection:bg-indigo-500/30 selection:text-indigo-200 transition-colors duration-300">
      {/* Apple & Samsung Cinematic Hero Section */}
      <HeroSection onExplore={handleExplore} />

      {/* Seamless Ambient Transition Blend Zone */}
      <div className="relative w-full h-20 sm:h-28 -mt-20 sm:-mt-28 pointer-events-none bg-gradient-to-b from-transparent via-[var(--bg-main)]/70 to-[var(--bg-main)] z-10" />

      {/* Main Interactive Enterprise Workstation */}
      <div ref={dashboardRef} id="console-view" className="relative z-10 scroll-mt-4 w-full">
        <AppLayout activeTab={activeTab} onTabChange={setActiveTab}>
          {activeTab === 'esg' && (
            <RevealSection className="view-container">
              <MunicipalityESGDashboard />
            </RevealSection>
          )}

          {activeTab === 'ledger' && (
            <RevealSection className="view-container">
              <ShipmentAuditLedger />
            </RevealSection>
          )}

          {activeTab === 'intake' && (
            <RevealSection className="view-container">
              <FacilityIntakeTerminal />
            </RevealSection>
          )}

          {activeTab === 'certificate' && (
            <RevealSection className="view-container">
              <CarbonSimulator />
            </RevealSection>
          )}

          {activeTab === 'gis' && (
            <RevealSection className="view-container">
              <GisRouteViewer />
            </RevealSection>
          )}

          {activeTab === 'form' && (
            <RevealSection className="workspace-split">
              <div className="form-column">
                <WasteCollectionForm />
              </div>
              <div className="sidebar-column">
                <QueueViewer />
                <ShipmentAuditLog />
              </div>
            </RevealSection>
          )}
        </AppLayout>
      </div>
    </div>
  );
};
