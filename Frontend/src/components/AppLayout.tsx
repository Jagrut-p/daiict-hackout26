import React, { useState, useEffect, useRef } from 'react';
import {
  Recycle,
  Layers,
  Map as MapIcon,
  FileSpreadsheet,
  Scale,
  BarChart3,
  Award,
  ChevronDown,
  Building2,
  Truck,
  Menu,
  X,
  Sparkles,
  Check,
  Sun,
  Moon,
} from 'lucide-react';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { useBackendStatus } from '../hooks/useBackendStatus';
import { useTheme } from '../hooks/useTheme';
import { Server } from 'lucide-react';

export type PersonaType = 'generator' | 'logistics' | 'facility' | 'executive' | 'all';

export interface NavTabItem {
  id: string;
  label: string;
  icon: React.ElementType;
  badge?: string;
  description: string;
}

export interface PersonaDefinition {
  id: PersonaType;
  name: string;
  badge: string;
  roleTitle: string;
  icon: React.ElementType;
  themeColor: string;
  allowedTabIds: string[];
}

// Master list of all available application navigation tabs
export const MASTER_NAV_TABS: NavTabItem[] = [
  {
    id: 'form',
    label: 'Waste Registration',
    icon: Layers,
    description: 'Register manifests & offline queue',
    badge: 'Offline-Ready',
  },
  {
    id: 'gis',
    label: 'Route Map',
    icon: MapIcon,
    description: 'Dynamic GIS routing & carbon avoidance',
    badge: 'GIS Live',
  },
  {
    id: 'ledger',
    label: 'Audit Ledger',
    icon: FileSpreadsheet,
    description: 'Historical verified transaction log',
    badge: 'Verified',
  },
  {
    id: 'intake',
    label: 'Intake Terminal',
    icon: Scale,
    description: 'Weigh-station scale & discrepancy audit',
    badge: 'Bay 02',
  },
  {
    id: 'esg',
    label: 'ESG Analytics',
    icon: BarChart3,
    description: 'Scope 1/3 abatement & municipality KPIs',
    badge: 'Executive',
  },
  {
    id: 'certificate',
    label: 'Carbon Simulator',
    icon: Award,
    description: 'MRV anti-tamper certificate engine',
    badge: 'AR6 Engine',
  },
];

// Persona definitions mapping strictly to required permissions
export const PERSONA_CONFIGS: PersonaDefinition[] = [
  {
    id: 'generator',
    name: 'Generator',
    badge: 'Waste Producer',
    roleTitle: 'Industrial Generator Agent',
    icon: Building2,
    themeColor: 'from-teal-500 to-cyan-500',
    allowedTabIds: ['form'],
  },
  {
    id: 'logistics',
    name: 'Logistics Manager',
    badge: 'Fleet Ops',
    roleTitle: 'Dispatch & Fleet Logistics Controller',
    icon: Truck,
    themeColor: 'from-sky-500 to-blue-500',
    allowedTabIds: ['gis', 'ledger'],
  },
  {
    id: 'facility',
    name: 'Facility Operator',
    badge: 'Weighmaster',
    roleTitle: 'Processing Facility Weighmaster',
    icon: Scale,
    themeColor: 'from-amber-500 to-orange-500',
    allowedTabIds: ['intake'],
  },
  {
    id: 'executive',
    name: 'City Executive',
    badge: 'City ESG',
    roleTitle: 'Municipal Sustainability Director',
    icon: BarChart3,
    themeColor: 'from-violet-500 to-purple-500',
    allowedTabIds: ['esg', 'certificate'],
  },
  {
    id: 'all',
    name: 'Full System / Admin',
    badge: 'All Access',
    roleTitle: 'Enterprise Administrator Mode',
    icon: Sparkles,
    themeColor: 'from-indigo-400 via-violet-400 to-fuchsia-400',
    allowedTabIds: ['form', 'gis', 'ledger', 'intake', 'esg', 'certificate'],
  },
];

export interface AppLayoutProps {
  activeTab: string;
  onTabChange: (tabId: string) => void;
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  activeTab,
  onTabChange,
  children,
}) => {
  const { isOnline, isSimulatedOffline } = useNetworkStatus();
  const { isBackendOnline, latencyMs, checkHealth } = useBackendStatus(6000);
  const { theme, toggleTheme } = useTheme();
  const [activePersona, setActivePersona] = useState<PersonaType>('executive');
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentPersona =
    PERSONA_CONFIGS.find((p) => p.id === activePersona) || PERSONA_CONFIGS[0];

  const visibleTabs = MASTER_NAV_TABS.filter((tab) =>
    currentPersona.allowedTabIds.includes(tab.id)
  );

  const handlePersonaChange = (newPersonaId: PersonaType) => {
    setActivePersona(newPersonaId);
    setIsDropdownOpen(false);

    const newAllowedTabs = MASTER_NAV_TABS.filter((tab) =>
      (PERSONA_CONFIGS.find((p) => p.id === newPersonaId) || PERSONA_CONFIGS[0]).allowedTabIds.includes(tab.id)
    );

    if (!newAllowedTabs.some((tab) => tab.id === activeTab)) {
      if (newAllowedTabs.length > 0) {
        onTabChange(newAllowedTabs[0].id);
      }
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-main)] text-[var(--text-primary)] flex flex-col font-sans selection:bg-indigo-500/40 selection:text-white transition-colors duration-300">
      {/* TOP NAVBAR — softer, refined, theme-aware */}
      <header className="sticky top-0 z-50 bg-[var(--header-bg)] backdrop-blur-2xl border-b border-[var(--border-color)] transition-colors duration-300">
        <div className="max-w-[1440px] mx-auto px-6 sm:px-8 lg:px-10 h-[72px] flex items-center justify-between gap-5">
          {/* Logo with Smooth Scroll to Hero */}
          <div
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="flex items-center gap-3.5 cursor-pointer group"
            title="Scroll to Top / Hero Showcase"
          >
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500/20 via-violet-500/15 to-fuchsia-500/10 border border-indigo-400/25 flex items-center justify-center shadow-lg shadow-indigo-500/10 group-hover:border-indigo-400/50 transition-all duration-300 group-hover:scale-105">
              <Recycle size={20} className="animate-spin-slow text-indigo-400 group-hover:text-indigo-300" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="brand-logo-text text-base sm:text-lg font-extrabold tracking-tight bg-gradient-to-r from-white via-indigo-200 to-violet-300 bg-clip-text text-transparent group-hover:brightness-110 transition-all">
                  CarbonRoute
                </h1>
                <span className="hidden sm:inline-block px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold bg-indigo-500/10 text-indigo-300 border border-indigo-400/20">
                  MRV
                </span>
              </div>
              <p className="hidden md:block text-xs text-slate-500 tracking-wide group-hover:text-slate-400 transition-colors">
                Municipal Climate Intelligence Platform
              </p>
            </div>
          </div>

          {/* Right Header Group */}
          <div className="flex items-center gap-2.5 sm:gap-3.5">
            {/* Quick Hero Showcase Button */}
            <button
              type="button"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-slate-300 hover:text-white text-xs font-medium transition-all"
              title="Return to Hero Presentation"
            >
              <Sparkles size={12} className="text-indigo-400" />
              <span>Showcase</span>
            </button>

            {/* Dark / Light Theme Toggle Button */}
            <button
              type="button"
              id="theme-toggle-btn"
              onClick={toggleTheme}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-slate-300 hover:text-white text-xs font-medium transition-all shadow-sm"
              title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
              aria-label={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
            >
              {theme === 'dark' ? (
                <>
                  <Sun size={13} className="text-amber-400" />
                  <span className="hidden sm:inline">Light</span>
                </>
              ) : (
                <>
                  <Moon size={13} className="text-indigo-400" />
                  <span className="hidden sm:inline">Dark</span>
                </>
              )}
            </button>
            {/* Backend Status */}
            <div
              onClick={() => checkHealth()}
              title={`FastAPI Backend: http://127.0.0.1:8000 ${latencyMs !== null ? `(${latencyMs}ms)` : ''} — Click to re-ping`}
              className={`cursor-pointer hidden md:flex items-center gap-2 px-3.5 py-2 rounded-full border text-xs font-medium transition-all duration-300 ${
                isBackendOnline
                  ? 'bg-sky-500/[0.07] border-sky-400/20 text-sky-300/90 hover:bg-sky-500/[0.12]'
                  : 'bg-rose-500/[0.07] border-rose-400/20 text-rose-300/90 hover:bg-rose-500/[0.12]'
              }`}
            >
              <Server size={11} className={isBackendOnline ? 'text-sky-400/80' : 'text-rose-400/80'} />
              <span className="relative flex h-1.5 w-1.5">
                <span
                  className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-60 ${
                    isBackendOnline ? 'bg-sky-400' : 'bg-rose-400'
                  }`}
                />
                <span
                  className={`relative inline-flex rounded-full h-1.5 w-1.5 ${
                    isBackendOnline ? 'bg-sky-400' : 'bg-rose-400'
                  }`}
                />
              </span>
              <span className="font-mono tracking-wider">
                {isBackendOnline ? `API Connected${latencyMs !== null ? ` (${latencyMs}ms)` : ''}` : 'API Offline'}
              </span>
            </div>

            {/* System Status */}
            <div
              className={`hidden sm:flex items-center gap-2 px-3.5 py-2 rounded-full border text-xs font-medium transition-all duration-300 ${
                isOnline
                  ? 'bg-teal-500/[0.07] border-teal-400/20 text-teal-300/80'
                  : 'bg-amber-500/[0.07] border-amber-400/20 text-amber-300/80'
              }`}
            >
              <span className="relative flex h-1.5 w-1.5">
                <span
                  className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-60 ${
                    isOnline ? 'bg-teal-400' : 'bg-amber-400'
                  }`}
                />
                <span
                  className={`relative inline-flex rounded-full h-1.5 w-1.5 ${
                    isOnline ? 'bg-teal-400' : 'bg-amber-400'
                  }`}
                />
              </span>
              <span className="font-mono tracking-wider">
                {isOnline ? 'Online' : `Offline ${isSimulatedOffline ? '(Sim)' : ''}`}
              </span>
            </div>

            {/* Persona Switcher */}
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                id="persona-switcher-button"
                onClick={() => setIsDropdownOpen((prev) => !prev)}
                className="flex items-center gap-2.5 px-4 py-2 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] hover:border-white/[0.14] transition-all duration-300 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                aria-expanded={isDropdownOpen}
                aria-haspopup="true"
              >
                <div className="w-6 h-6 rounded-lg bg-indigo-500/15 text-indigo-300 flex items-center justify-center">
                  <currentPersona.icon size={13} />
                </div>

                <div className="text-left">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-slate-200 leading-none">
                      {currentPersona.name}
                    </span>
                    <span className="text-xs font-mono px-1.5 py-0.5 rounded-md bg-white/[0.05] text-slate-400 border border-white/[0.06]">
                      {currentPersona.badge}
                    </span>
                  </div>
                </div>

                <ChevronDown
                  size={14}
                  className={`text-slate-400 transition-transform duration-200 ${
                    isDropdownOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {/* Persona Dropdown Menu */}
              {isDropdownOpen && (
                <div className="absolute right-0 mt-3 w-80 rounded-2xl bg-[#111218]/98 border border-white/[0.08] shadow-2xl backdrop-blur-2xl p-2.5 z-50 animate-fade-in">
                  <div className="px-3 py-2.5 text-xs uppercase font-mono tracking-widest text-slate-500">
                    Switch Operating Persona
                  </div>

                  <div className="space-y-1">
                    {PERSONA_CONFIGS.map((persona) => {
                      const isSelected = persona.id === activePersona;
                      const IconComponent = persona.icon;

                      return (
                        <button
                          key={persona.id}
                          type="button"
                          onClick={() => handlePersonaChange(persona.id)}
                          className={`w-full flex items-center justify-between p-3 rounded-xl text-left transition-all duration-200 ${
                            isSelected
                              ? 'bg-indigo-500/10 border border-indigo-400/25 text-indigo-100'
                              : 'hover:bg-white/[0.04] text-slate-400 border border-transparent'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
                                isSelected
                                  ? 'bg-indigo-500 text-white'
                                  : 'bg-white/[0.05] text-slate-500'
                              }`}
                            >
                              <IconComponent size={16} />
                            </div>

                            <div>
                              <span className="text-sm font-semibold text-slate-200 block">
                                {persona.name}
                              </span>
                              <p className="text-xs text-slate-500 leading-tight">
                                {persona.roleTitle}
                              </p>
                            </div>
                          </div>

                          {isSelected && (
                            <Check size={14} className="text-indigo-400 shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  <div className="px-3 py-2.5 text-xs text-slate-500 flex items-center justify-between bg-white/[0.02] rounded-xl mt-1.5">
                    <span>Views Available</span>
                    <span className="font-mono text-indigo-400 font-semibold">
                      {visibleTabs.length}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Mobile Toggle */}
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen((prev) => !prev)}
              className="md:hidden p-2.5 rounded-xl bg-white/[0.04] text-slate-400 hover:text-white border border-white/[0.06] transition-colors"
            >
              {isMobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>
      </header>

      {/* BODY LAYOUT */}
      <div className="flex-1 max-w-[1440px] w-full mx-auto px-6 sm:px-8 lg:px-10 py-10 flex flex-col md:flex-row gap-10">
        {/* SIDEBAR */}
        <aside className="hidden md:flex flex-col w-72 shrink-0 space-y-6">
          {/* Persona Indicator */}
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-500/15 text-indigo-300 flex items-center justify-center">
                <currentPersona.icon size={16} />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-xs font-mono text-slate-500 uppercase tracking-wider block">
                  Current Persona
                </span>
                <span className="text-sm font-semibold text-slate-200 truncate block">
                  {currentPersona.name}
                </span>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-white/[0.06] text-xs text-slate-500 flex items-center justify-between">
              <span>Navigation Scope</span>
              <span className="font-mono text-indigo-400 font-semibold">
                {visibleTabs.length} Tab{visibleTabs.length === 1 ? '' : 's'}
              </span>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-3 shadow-xl space-y-1">
            <div className="px-3 py-2.5 text-xs uppercase font-mono tracking-widest text-slate-500 font-semibold">
              Modules
            </div>

            {visibleTabs.map((tab) => {
              const isActive = activeTab === tab.id;
              const Icon = tab.icon;

              return (
                <button
                  key={tab.id}
                  type="button"
                  id={`nav-tab-${tab.id}`}
                  onClick={() => onTabChange(tab.id)}
                  className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-left transition-all duration-200 group relative ${
                    isActive
                      ? 'bg-indigo-500/[0.08] text-white font-semibold border border-indigo-400/20'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04] font-medium border border-transparent'
                  }`}
                >
                  {isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-indigo-400 rounded-r-full shadow-[0_0_12px_rgba(99,102,241,0.5)]" />
                  )}

                  <div className="flex items-center gap-3 min-w-0">
                    <Icon
                      size={17}
                      className={`shrink-0 transition-colors duration-200 ${
                        isActive ? 'text-indigo-400' : 'text-slate-500 group-hover:text-slate-300'
                      }`}
                    />
                    <div className="truncate">
                      <span className="text-sm block leading-tight">{tab.label}</span>
                      <span className="text-xs text-slate-500 font-normal truncate block mt-0.5">
                        {tab.description}
                      </span>
                    </div>
                  </div>

                  {tab.badge && (
                    <span
                      className={`text-xs font-mono px-2 py-0.5 rounded-full shrink-0 border transition-colors ${
                        isActive
                          ? 'bg-indigo-500/15 text-indigo-300 border-indigo-400/25'
                          : 'bg-white/[0.03] text-slate-500 border-white/[0.06]'
                      }`}
                    >
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* MOBILE NAV */}
        {isMobileMenuOpen && (
          <div className="md:hidden bg-[#111218]/95 border border-white/[0.06] rounded-2xl p-3 shadow-2xl mb-5 space-y-1 animate-fade-in backdrop-blur-2xl">
            <div className="px-2.5 py-1.5 text-xs font-mono text-slate-500 uppercase tracking-wider">
              {currentPersona.name} Navigation
            </div>
            {visibleTabs.map((tab) => {
              const isActive = activeTab === tab.id;
              const Icon = tab.icon;

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    onTabChange(tab.id);
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between p-3 rounded-xl text-sm font-semibold transition-all ${
                    isActive
                      ? 'bg-indigo-500 text-white'
                      : 'text-slate-400 hover:bg-white/[0.05]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon size={16} />
                    <span>{tab.label}</span>
                  </div>
                  {tab.badge && (
                    <span className="text-xs font-mono opacity-70">{tab.badge}</span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* MAIN CONTENT */}
        <main className="flex-1 min-w-0 space-y-10">{children}</main>
      </div>
    </div>
  );
};
