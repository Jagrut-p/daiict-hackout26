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
} from 'lucide-react';
import { useNetworkStatus } from '../hooks/useNetworkStatus';

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
    themeColor: 'from-emerald-500 to-teal-500',
    allowedTabIds: ['form'], // Access: Waste Registration
  },
  {
    id: 'logistics',
    name: 'Logistics Manager',
    badge: 'Fleet Ops',
    roleTitle: 'Dispatch & Fleet Logistics Controller',
    icon: Truck,
    themeColor: 'from-cyan-500 to-blue-500',
    allowedTabIds: ['gis', 'ledger'], // Access: Route Map, Audit Ledger
  },
  {
    id: 'facility',
    name: 'Facility Operator',
    badge: 'Weighmaster',
    roleTitle: 'Processing Facility Weighmaster',
    icon: Scale,
    themeColor: 'from-amber-500 to-orange-500',
    allowedTabIds: ['intake'], // Access: Intake Terminal
  },
  {
    id: 'executive',
    name: 'City Executive',
    badge: 'City ESG',
    roleTitle: 'Municipal Sustainability Director',
    icon: BarChart3,
    themeColor: 'from-purple-500 to-pink-500',
    allowedTabIds: ['esg', 'certificate'], // Access: ESG Analytics, Carbon Simulator
  },
  {
    id: 'all',
    name: 'Full System / Admin',
    badge: 'All Access',
    roleTitle: 'Enterprise Administrator Mode',
    icon: Sparkles,
    themeColor: 'from-emerald-400 via-cyan-400 to-purple-400',
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
  const [activePersona, setActivePersona] = useState<PersonaType>('executive');
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
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

  // TEST CASE 1: Filter visible navigation tabs dynamically based on selected Persona's allowed permissions
  const visibleTabs = MASTER_NAV_TABS.filter((tab) =>
    currentPersona.allowedTabIds.includes(tab.id)
  );

  // If the currently active tab is not accessible under the new persona, switch automatically to the first permitted tab
  const handlePersonaChange = (newPersonaId: PersonaType) => {
    setActivePersona(newPersonaId);
    setIsDropdownOpen(false);

    const targetPersona = PERSONA_CONFIGS.find((p) => p.id === newPersonaId);
    if (targetPersona && !targetPersona.allowedTabIds.includes(activeTab)) {
      if (targetPersona.allowedTabIds.length > 0) {
        onTabChange(targetPersona.allowedTabIds[0]);
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-slate-950">
      {/* 1. TOP NAVBAR */}
      <header className="sticky top-0 z-50 bg-slate-950/85 backdrop-blur-xl border-b border-slate-800/80 shadow-2xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* App Logo & Branding: "CarbonRoute MRV" */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 via-cyan-500/20 to-teal-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-500/15">
              <Recycle size={22} className="animate-spin-slow text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-black tracking-tight bg-gradient-to-r from-white via-emerald-300 to-cyan-300 bg-clip-text text-transparent">
                  CarbonRoute MRV
                </h1>
                <span className="hidden sm:inline-block px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  v2.4
                </span>
              </div>
              <p className="hidden md:block text-[11px] text-slate-400">
                Municipal Climate Intelligence & Verified Route Ledger
              </p>
            </div>
          </div>

          {/* Right Header Group: Live Status Badge & Persona Switcher */}
          <div className="flex items-center gap-3 sm:gap-4">
            {/* Live System Status Badge: "System Operational" */}
            <div
              className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold shadow-sm transition-all ${
                isOnline
                  ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                  : 'bg-amber-950/40 border-amber-500/40 text-amber-300'
              }`}
            >
              <span className="relative flex h-2 w-2">
                <span
                  className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                    isOnline ? 'bg-emerald-400' : 'bg-amber-400'
                  }`}
                />
                <span
                  className={`relative inline-flex rounded-full h-2 w-2 ${
                    isOnline ? 'bg-emerald-500' : 'bg-amber-500'
                  }`}
                />
              </span>
              <span className="font-mono text-[11px] tracking-wide">
                {isOnline ? 'System Operational' : `Offline Sync Active ${isSimulatedOffline ? '(Sim)' : ''}`}
              </span>
            </div>

            {/* Persona Switcher Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                id="persona-switcher-button"
                onClick={() => setIsDropdownOpen((prev) => !prev)}
                className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800/90 border border-slate-700/80 hover:border-slate-600 transition-all shadow-md focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                aria-expanded={isDropdownOpen}
                aria-haspopup="true"
              >
                <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <currentPersona.icon size={14} />
                </div>

                <div className="text-left">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-white leading-none">
                      {currentPersona.name}
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700">
                      {currentPersona.badge}
                    </span>
                  </div>
                </div>

                <ChevronDown
                  size={14}
                  className={`text-slate-400 transition-transform duration-200 ${
                    isDropdownOpen ? 'rotate-180 text-emerald-400' : ''
                  }`}
                />
              </button>

              {/* Persona Options Dropdown Menu */}
              {isDropdownOpen && (
                <div className="absolute right-0 mt-2 w-72 rounded-2xl bg-slate-900/95 border border-slate-700/80 shadow-2xl backdrop-blur-xl p-2 z-50 animate-fade-in divide-y divide-slate-800/80">
                  <div className="px-3 py-2 text-[10px] uppercase font-mono tracking-wider text-slate-400">
                    Switch Active Persona Role
                  </div>

                  <div className="py-1 space-y-1">
                    {PERSONA_CONFIGS.map((persona) => {
                      const isSelected = activePersona === persona.id;
                      const IconComponent = persona.icon;

                      return (
                        <button
                          key={persona.id}
                          type="button"
                          onClick={() => handlePersonaChange(persona.id)}
                          className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left transition-all ${
                            isSelected
                              ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-200 shadow-sm'
                              : 'hover:bg-slate-800/70 text-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <div
                              className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                                isSelected
                                  ? 'bg-emerald-500 text-slate-950 font-bold'
                                  : 'bg-slate-800 text-slate-400'
                              }`}
                            >
                              <IconComponent size={16} />
                            </div>

                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-bold text-white">
                                  {persona.name}
                                </span>
                              </div>
                              <p className="text-[10px] text-slate-400 leading-tight">
                                {persona.roleTitle}
                              </p>
                            </div>
                          </div>

                          {isSelected && (
                            <Check size={14} className="text-emerald-400 shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  <div className="px-3 py-2 text-[10px] text-slate-400 flex items-center justify-between bg-slate-950/60 rounded-xl mt-1">
                    <span>Active Views Scope:</span>
                    <span className="font-mono text-emerald-400 font-bold">
                      {visibleTabs.length} View{visibleTabs.length === 1 ? '' : 's'} Allowed
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Mobile Navigation Toggle Button */}
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen((prev) => !prev)}
              className="md:hidden p-2 rounded-xl bg-slate-900 text-slate-300 hover:text-white border border-slate-800"
            >
              {isMobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>
      </header>

      {/* 2. BODY LAYOUT: SIDEBAR + MAIN CONTENT AREA */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col md:flex-row gap-6">
        {/* SIDEBAR NAVIGATION (Desktop) */}
        <aside className="hidden md:flex flex-col w-64 shrink-0 space-y-4">
          {/* Persona Permissions Scope Indicator */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-lg">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                <currentPersona.icon size={16} />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[10px] font-mono text-slate-500 uppercase block">
                  Current Persona
                </span>
                <span className="text-xs font-bold text-white truncate block">
                  {currentPersona.name}
                </span>
              </div>
            </div>

            <div className="mt-3 pt-2 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
              <span>Navigation Scope:</span>
              <span className="font-mono text-emerald-400 font-semibold">
                {visibleTabs.length} Tab{visibleTabs.length === 1 ? '' : 's'}
              </span>
            </div>
          </div>

          {/* SIDEBAR NAVIGATION TABS: Test Case 1 & Test Case 2 */}
          <nav className="bg-slate-900/90 border border-slate-800 rounded-2xl p-2.5 shadow-xl space-y-1">
            <div className="px-3 py-2 text-[10px] uppercase font-mono tracking-wider text-slate-500 font-bold">
              Available Modules
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
                  // TEST CASE 2: Active tab styling clearly highlights which view is currently rendered
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-all group relative ${
                    isActive
                      ? 'bg-gradient-to-r from-emerald-500/20 to-teal-500/10 text-white font-bold border border-emerald-500/40 shadow-lg shadow-emerald-500/10'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 font-medium'
                  }`}
                >
                  {/* Glowing left indicator line on active tab */}
                  {isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-emerald-400 rounded-r-full shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                  )}

                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon
                      size={18}
                      className={`shrink-0 transition-colors ${
                        isActive ? 'text-emerald-400' : 'text-slate-500 group-hover:text-slate-300'
                      }`}
                    />
                    <div className="truncate">
                      <span className="text-xs block leading-tight">{tab.label}</span>
                      <span className="text-[10px] text-slate-500 font-normal truncate block">
                        {tab.description}
                      </span>
                    </div>
                  </div>

                  {tab.badge && (
                    <span
                      className={`text-[9px] font-mono px-1.5 py-0.5 rounded-full shrink-0 border ${
                        isActive
                          ? 'bg-emerald-500/25 text-emerald-300 border-emerald-500/40'
                          : 'bg-slate-800 text-slate-500 border-slate-700'
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

        {/* MOBILE NAVIGATION DRAWER */}
        {isMobileMenuOpen && (
          <div className="md:hidden bg-slate-900 border border-slate-800 rounded-2xl p-3 shadow-2xl mb-4 space-y-1 animate-fade-in">
            <div className="px-2 py-1 text-[10px] font-mono text-slate-400 uppercase">
              Persona Navigation ({currentPersona.name})
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
                  className={`w-full flex items-center justify-between p-2.5 rounded-xl text-xs font-semibold ${
                    isActive
                      ? 'bg-emerald-500 text-slate-950 font-bold'
                      : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Icon size={16} />
                    <span>{tab.label}</span>
                  </div>
                  {tab.badge && (
                    <span className="text-[10px] font-mono opacity-80">{tab.badge}</span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* MAIN VIEWPORT CONTENT */}
        <main className="flex-1 min-w-0 space-y-6">{children}</main>
      </div>
    </div>
  );
};
