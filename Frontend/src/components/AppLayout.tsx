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
  ChevronLeft,
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

export interface PersonaStyleConfig {
  gradient: string;
  borderGlow: string;
  textAccent: string;
  bgSubtle: string;
  activeTabBg: string;
  activeTabBorder: string;
  shadow: string;
}

export const PERSONA_STYLES: Record<PersonaType, PersonaStyleConfig> = {
  generator: {
    gradient: 'from-teal-500 to-cyan-500',
    borderGlow: 'border-teal-400/30',
    textAccent: 'text-teal-600 dark:text-teal-300',
    bgSubtle: 'bg-teal-500/15',
    activeTabBg: 'bg-teal-500/[0.12]',
    activeTabBorder: 'border-teal-400/30',
    shadow: 'shadow-teal-500/25',
  },
  logistics: {
    gradient: 'from-sky-500 to-blue-500',
    borderGlow: 'border-sky-400/30',
    textAccent: 'text-sky-600 dark:text-sky-300',
    bgSubtle: 'bg-sky-500/15',
    activeTabBg: 'bg-sky-500/[0.12]',
    activeTabBorder: 'border-sky-400/30',
    shadow: 'shadow-sky-500/25',
  },
  facility: {
    gradient: 'from-amber-500 to-orange-500',
    borderGlow: 'border-amber-400/30',
    textAccent: 'text-amber-600 dark:text-amber-300',
    bgSubtle: 'bg-amber-500/15',
    activeTabBg: 'bg-amber-500/[0.12]',
    activeTabBorder: 'border-amber-400/30',
    shadow: 'shadow-amber-500/25',
  },
  executive: {
    gradient: 'from-violet-500 to-purple-500',
    borderGlow: 'border-violet-400/30',
    textAccent: 'text-violet-600 dark:text-violet-300',
    bgSubtle: 'bg-violet-500/15',
    activeTabBg: 'bg-violet-500/[0.12]',
    activeTabBorder: 'border-violet-400/30',
    shadow: 'shadow-violet-500/25',
  },
  all: {
    gradient: 'from-indigo-400 via-violet-400 to-fuchsia-400',
    borderGlow: 'border-indigo-400/30',
    textAccent: 'text-indigo-600 dark:text-indigo-300',
    bgSubtle: 'bg-indigo-500/15',
    activeTabBg: 'bg-indigo-500/[0.12]',
    activeTabBorder: 'border-indigo-400/30',
    shadow: 'shadow-indigo-500/25',
  },
};

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
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
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
  const currentPersonaStyle = PERSONA_STYLES[activePersona] || PERSONA_STYLES.executive;

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
    <div className="min-h-screen w-full overflow-x-hidden bg-[var(--bg-main)] text-[var(--text-primary)] flex flex-col font-sans selection:bg-indigo-500/40 selection:text-white transition-colors duration-300">
      {/* Dynamic Persona Identity Horizon Bar */}
      <div className={`h-[3px] w-full bg-gradient-to-r ${currentPersonaStyle.gradient} transition-all duration-500 shadow-sm`} />

      {/* TOP NAVBAR — softer, refined, theme-aware */}
      <header className="sticky top-0 z-50 bg-[var(--header-bg)] backdrop-blur-2xl border-b border-[var(--border-color)] transition-colors duration-300">
        <div className="app-container-frame px-4 sm:px-6 lg:px-8 h-[72px] flex items-center justify-between gap-4">
          {/* Logo with Smooth Scroll to Hero */}
          <div
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }
            }}
            role="button"
            tabIndex={0}
            aria-label="CarbonRoute MRV - Scroll to Top / Hero Showcase"
            className="flex items-center gap-3.5 cursor-pointer group focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none rounded-2xl p-1 -m-1"
            title="Scroll to Top / Hero Showcase"
          >
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500/20 via-violet-500/15 to-fuchsia-500/10 border border-indigo-400/25 flex items-center justify-center shadow-lg shadow-indigo-500/10 group-hover:border-indigo-400/50 transition-all duration-300 group-hover:scale-105">
              <Recycle size={20} className="animate-spin-slow text-indigo-400 group-hover:text-indigo-300" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="brand-logo-text text-base sm:text-lg font-extrabold tracking-tight bg-gradient-to-r from-[var(--text-primary)] via-indigo-400 to-violet-500 bg-clip-text text-transparent group-hover:brightness-110 transition-all">
                  CarbonRoute
                </h1>
                <span className="hidden sm:inline-block px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold bg-indigo-500/10 text-indigo-400 dark:text-indigo-300 border border-indigo-400/20">
                  MRV
                </span>
              </div>
              <p className="hidden md:block text-xs text-[var(--text-muted)] tracking-wide group-hover:text-[var(--text-secondary)] transition-colors">
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
              aria-label="Showcase: Return to hero presentation"
              className="hidden lg:flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[var(--bg-card-subtle)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xs font-medium transition-all focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
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
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[var(--bg-card-subtle)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xs font-medium transition-all shadow-sm group focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
              title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
              aria-label={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
            >
              {theme === 'dark' ? (
                <>
                  <Sun size={13} className="text-amber-400 transition-transform duration-500 group-hover:rotate-45" />
                  <span className="hidden sm:inline">Light</span>
                </>
              ) : (
                <>
                  <Moon size={13} className="text-indigo-400 transition-transform duration-500 group-hover:-rotate-12" />
                  <span className="hidden sm:inline">Dark</span>
                </>
              )}
            </button>

            {/* Backend Status */}
            <button
              type="button"
              role="status"
              aria-label={`FastAPI Backend status: ${isBackendOnline ? 'Online' : 'Offline'}${latencyMs !== null ? `, ${latencyMs} milliseconds latency` : ''}. Press to test backend connection.`}
              onClick={() => checkHealth()}
              title={`FastAPI Backend: http://127.0.0.1:8000 ${latencyMs !== null ? `(${latencyMs}ms)` : ''} — Click to re-ping`}
              className={`cursor-pointer hidden md:flex items-center gap-2 px-3.5 py-2 rounded-full border text-xs font-medium transition-all duration-300 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none ${
                isBackendOnline
                  ? 'bg-sky-500/[0.07] border-sky-400/20 text-sky-400 dark:text-sky-300 hover:bg-sky-500/[0.12]'
                  : 'bg-rose-500/[0.07] border-rose-400/20 text-rose-500 dark:text-rose-300 hover:bg-rose-500/[0.12]'
              }`}
            >
              <Server size={11} className={isBackendOnline ? 'text-sky-400' : 'text-rose-400'} />
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
            </button>

            {/* System Status */}
            <div
              role="status"
              aria-label={`Network status: ${isOnline ? 'Online' : 'Offline'}`}
              className={`hidden sm:flex items-center gap-2 px-3.5 py-2 rounded-full border text-xs font-medium transition-all duration-300 ${
                isOnline
                  ? 'bg-teal-500/[0.07] border-teal-400/20 text-teal-600 dark:text-teal-300/90'
                  : 'bg-amber-500/[0.07] border-amber-400/20 text-amber-600 dark:text-amber-300/90'
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
                role="combobox"
                aria-haspopup="listbox"
                aria-expanded={isDropdownOpen}
                aria-controls="persona-dropdown-menu"
                aria-label={`Operating persona switcher. Current persona: ${currentPersona.name}`}
                onClick={() => setIsDropdownOpen((prev) => !prev)}
                className="flex items-center gap-2.5 px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-2xl bg-[var(--bg-card-subtle)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-color)] transition-all duration-300 shadow-sm focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
              >
                <div className={`w-7 h-7 rounded-xl bg-gradient-to-br ${currentPersonaStyle.gradient} text-white flex items-center justify-center shadow-sm ${currentPersonaStyle.shadow}`}>
                  <currentPersona.icon size={13} />
                </div>

                <div className="text-left">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-[var(--text-primary)] leading-none">
                      {currentPersona.name}
                    </span>
                    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-gradient-to-r ${currentPersonaStyle.gradient} text-white font-bold shadow-sm`}>
                      {currentPersona.badge}
                    </span>
                  </div>
                </div>

                <ChevronDown
                  size={14}
                  className={`text-[var(--text-muted)] transition-transform duration-200 ${
                    isDropdownOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {/* Persona Dropdown Menu */}
              {isDropdownOpen && (
                <div
                  id="persona-dropdown-menu"
                  role="listbox"
                  aria-label="Operating Personas"
                  className="absolute right-0 mt-3 w-80 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-color)] shadow-2xl backdrop-blur-2xl p-2.5 z-50 animate-fade-in text-[var(--text-primary)]"
                >
                  <div className="px-3 py-2.5 text-xs uppercase font-mono tracking-widest text-[var(--text-muted)]">
                    Switch Operating Persona
                  </div>

                  <div className="space-y-1">
                    {PERSONA_CONFIGS.map((persona) => {
                      const isSelected = persona.id === activePersona;
                      const IconComponent = persona.icon;
                      const personaItemStyle = PERSONA_STYLES[persona.id] || PERSONA_STYLES.executive;

                      return (
                        <button
                          key={persona.id}
                          type="button"
                          role="option"
                          aria-selected={isSelected}
                          aria-label={`${persona.name} persona: ${persona.roleTitle}`}
                          onClick={() => handlePersonaChange(persona.id)}
                          className={`w-full flex items-center justify-between p-3 rounded-xl text-left transition-all duration-200 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none ${
                            isSelected
                              ? `bg-gradient-to-r ${personaItemStyle.gradient} text-white shadow-lg ${personaItemStyle.shadow} border border-transparent`
                              : 'hover:bg-[var(--bg-card-hover)] text-[var(--text-secondary)] border border-transparent'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
                                isSelected
                                  ? 'bg-white/20 text-white shadow-inner'
                                  : `${personaItemStyle.bgSubtle} ${personaItemStyle.textAccent}`
                              }`}
                            >
                              <IconComponent size={16} />
                            </div>

                            <div>
                              <span className={`text-sm font-semibold block ${isSelected ? 'text-white' : 'text-[var(--text-primary)]'}`}>
                                {persona.name}
                              </span>
                              <p className={`text-xs leading-tight ${isSelected ? 'text-white/80' : 'text-[var(--text-muted)]'}`}>
                                {persona.roleTitle}
                              </p>
                            </div>
                          </div>

                          {isSelected && (
                            <Check size={16} className="text-white shrink-0 font-bold" />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  <div className="px-3 py-2.5 text-xs text-[var(--text-muted)] flex items-center justify-between bg-[var(--bg-card-subtle)] border border-[var(--border-color)] rounded-xl mt-1.5">
                    <span>Views Available</span>
                    <span className={`font-mono font-bold ${currentPersonaStyle.textAccent}`}>
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
              aria-label={isMobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
              aria-expanded={isMobileMenuOpen}
              aria-controls="mobile-nav-drawer"
              className="md:hidden p-2.5 rounded-xl bg-[var(--bg-card-subtle)] hover:bg-[var(--bg-card-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-color)] transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
            >
              {isMobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>
      </header>

      {/* BODY LAYOUT: Fluid flexible container up to 1680px */}
      <div className="flex-1 w-full max-w-7xl 2xl:max-w-[1680px] mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8 flex flex-col md:flex-row gap-5 lg:gap-8 min-w-0">
        {/* SIDEBAR: Collapses to icons-only on medium screens (md: 768px - 1023px) before falling back to mobile drawer (< 768px) */}
        <aside
          className={`hidden md:flex flex-col shrink-0 space-y-4 transition-all duration-300 ${
            isSidebarCollapsed ? 'w-20' : 'w-20 lg:w-64 xl:w-72'
          }`}
        >
          {/* Persona Indicator */}
          <div className={`bg-[var(--bg-card)] border ${currentPersonaStyle.borderGlow} rounded-2xl p-3 lg:p-5 shadow-lg relative overflow-hidden transition-all duration-300`}>
            <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br ${currentPersonaStyle.gradient} opacity-10 rounded-full blur-xl pointer-events-none`} />
            <div className="flex items-center justify-center lg:justify-start gap-3 relative z-10">
              <div
                title={`${currentPersona.name} (${currentPersona.badge})`}
                className={`w-10 h-10 rounded-xl bg-gradient-to-br ${currentPersonaStyle.gradient} text-white flex items-center justify-center shadow-md ${currentPersonaStyle.shadow} shrink-0`}
              >
                <currentPersona.icon size={18} />
              </div>
              <div className={`min-w-0 flex-1 ${isSidebarCollapsed ? 'hidden' : 'hidden lg:block'}`}>
                <span className="text-xs font-mono text-[var(--text-muted)] uppercase tracking-wider block">
                  Current Persona
                </span>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-sm font-bold text-[var(--text-primary)] truncate block">
                    {currentPersona.name}
                  </span>
                  <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-gradient-to-r ${currentPersonaStyle.gradient} text-white font-bold shadow-sm shrink-0`}>
                    {currentPersona.badge}
                  </span>
                </div>
              </div>
            </div>

            <div className={`mt-4 pt-3 border-t border-[var(--border-color)] text-xs text-[var(--text-muted)] items-center justify-between relative z-10 ${isSidebarCollapsed ? 'hidden' : 'hidden lg:flex'}`}>
              <span>Navigation Scope</span>
              <span className={`font-mono font-bold ${currentPersonaStyle.textAccent}`}>
                {visibleTabs.length} Tab{visibleTabs.length === 1 ? '' : 's'}
              </span>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav
            role="tablist"
            aria-label="Console Navigation Modules"
            className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-2 lg:p-3 shadow-xl space-y-1"
          >
            <div className={`px-3 py-2 text-xs uppercase font-mono tracking-widest text-[var(--text-muted)] font-semibold flex items-center justify-between ${isSidebarCollapsed ? 'hidden' : 'hidden lg:flex'}`}>
              <span>Modules</span>
              <button
                type="button"
                onClick={() => setIsSidebarCollapsed((prev) => !prev)}
                aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar to icons"}
                title={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                className="p-1 rounded-lg hover:bg-[var(--bg-card-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
              >
                <ChevronLeft size={14} className={isSidebarCollapsed ? "rotate-180" : ""} />
              </button>
            </div>

            {visibleTabs.map((tab) => {
              const isActive = activeTab === tab.id;
              const Icon = tab.icon;

              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  id={`nav-tab-${tab.id}`}
                  aria-selected={isActive}
                  aria-current={isActive ? 'page' : undefined}
                  aria-label={`${tab.label}: ${tab.description}`}
                  title={`${tab.label} — ${tab.description}`}
                  onClick={() => onTabChange(tab.id)}
                  className={`w-full flex items-center justify-center lg:justify-between p-3 lg:px-3.5 lg:py-3 rounded-xl text-left transition-all duration-200 group relative focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none ${
                    isActive
                      ? `${currentPersonaStyle.activeTabBg} ${currentPersonaStyle.textAccent} font-semibold ${currentPersonaStyle.activeTabBorder} border shadow-sm`
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] font-medium border border-transparent'
                  }`}
                >
                  {isActive && (
                    <span className={`absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-6 bg-gradient-to-b ${currentPersonaStyle.gradient} rounded-r-full shadow-md ${currentPersonaStyle.shadow}`} />
                  )}

                  <div className="flex items-center gap-3 min-w-0">
                    <Icon
                      size={18}
                      className={`shrink-0 transition-colors duration-200 ${
                        isActive ? currentPersonaStyle.textAccent : 'text-[var(--text-muted)] group-hover:text-indigo-400'
                      }`}
                    />
                    <div className={`truncate ${isSidebarCollapsed ? 'hidden' : 'hidden lg:block'}`}>
                      <span className="text-sm block leading-tight">{tab.label}</span>
                      <span className="text-xs text-[var(--text-muted)] font-normal truncate block mt-0.5">
                        {tab.description}
                      </span>
                    </div>
                  </div>

                  {tab.badge && (
                    <span
                      className={`text-xs font-mono px-2.5 py-0.5 rounded-full shrink-0 transition-colors ${isSidebarCollapsed ? 'hidden' : 'hidden lg:inline-block'} ${
                        isActive
                          ? `bg-gradient-to-r ${currentPersonaStyle.gradient} text-white font-bold shadow-sm border-0`
                          : 'bg-[var(--bg-card-subtle)] text-[var(--text-muted)] border border-[var(--border-color)]'
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
          <div
            id="mobile-nav-drawer"
            role="tablist"
            aria-label="Mobile Navigation Modules"
            className="md:hidden bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl p-3 shadow-2xl mb-5 space-y-1 animate-fade-in backdrop-blur-2xl text-[var(--text-primary)]"
          >
            <div className="px-2.5 py-1.5 text-xs font-mono text-[var(--text-muted)] uppercase tracking-wider flex items-center justify-between">
              <span>{currentPersona.name} Navigation</span>
              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded bg-gradient-to-r ${currentPersonaStyle.gradient} text-white font-bold`}>
                {currentPersona.badge}
              </span>
            </div>
            {visibleTabs.map((tab) => {
              const isActive = activeTab === tab.id;
              const Icon = tab.icon;

              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-current={isActive ? 'page' : undefined}
                  aria-label={`${tab.label} module`}
                  onClick={() => {
                    onTabChange(tab.id);
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between p-3 rounded-xl text-sm font-semibold transition-all focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none ${
                    isActive
                      ? `bg-gradient-to-r ${currentPersonaStyle.gradient} text-white shadow-lg ${currentPersonaStyle.shadow}`
                      : 'text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon size={16} />
                    <span>{tab.label}</span>
                  </div>
                  {tab.badge && (
                    <span className={`text-xs font-mono ${isActive ? 'bg-white/20 text-white px-2 py-0.5 rounded-full' : 'opacity-70'}`}>
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* MAIN CONTENT */}
        <main className="flex-1 min-w-0 space-y-8">{children}</main>
      </div>
    </div>
  );
};
