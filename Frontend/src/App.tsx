import React, { useState } from 'react';
import { AppLayout } from './components/AppLayout';
import { WasteCollectionForm } from './components/WasteCollectionForm';
import { QueueViewer } from './components/QueueViewer';
import { NetworkSimulator } from './components/NetworkSimulator';
import { TestSuiteRunner } from './components/TestSuiteRunner';
import { ShipmentAuditLog } from './components/ShipmentAuditLog';

import { GisRouteViewer } from './components/GisRouteViewer';
import { CarbonSimulator } from './components/CarbonSimulator';
import { FacilityIntakeTerminal } from './components/FacilityIntakeTerminal';
import { ShipmentAuditLedger } from './components/ShipmentAuditLedger';
import { MunicipalityESGDashboard } from './components/MunicipalityESGDashboard';
import { SyncNotificationCenter } from './components/SyncNotificationCenter';
import { ShieldCheck } from 'lucide-react';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('esg');

  return (
    <AppLayout activeTab={activeTab} onTabChange={setActiveTab}>
      {/* Floating Network Alert Pill & Action Feedback Toast System */}
      <SyncNotificationCenter />

      {/* Network & Protocol Simulation Bar */}
      <NetworkSimulator />

      {/* Dynamic View Rendering based on active tab */}
      {activeTab === 'esg' && (
        <div className="esg-dashboard-view-container animate-fade-in">
          <MunicipalityESGDashboard />
        </div>
      )}

      {activeTab === 'ledger' && (
        <div className="ledger-view-container animate-fade-in">
          <ShipmentAuditLedger />
        </div>
      )}

      {activeTab === 'intake' && (
        <div className="intake-terminal-view-container animate-fade-in">
          <FacilityIntakeTerminal />
        </div>
      )}

      {activeTab === 'certificate' && (
        <div className="carbon-simulator-view-container animate-fade-in">
          <CarbonSimulator />
        </div>
      )}

      {activeTab === 'gis' && (
        <div className="gis-view-tab-container animate-fade-in">
          <GisRouteViewer />
        </div>
      )}

      {activeTab === 'form' && (
        <div className="workspace-split animate-fade-in">
          <div className="form-column">
            <WasteCollectionForm />
          </div>
          <div className="sidebar-column">
            <QueueViewer />
            <ShipmentAuditLog />
          </div>
        </div>
      )}

      {activeTab === 'tests' && (
        <div className="tests-view-container animate-fade-in">
          <TestSuiteRunner />
          <div className="mt-6">
            <QueueViewer />
          </div>
        </div>
      )}

      {activeTab === 'telemetry' && (
        <div className="telemetry-view-container animate-fade-in">
          <ShipmentAuditLog />
          <div className="mt-6">
            <QueueViewer />
          </div>
        </div>
      )}

      {/* Technical Requirements Checklist */}
      <section className="card requirements-card mt-6">
        <h4 className="card-title text-base font-bold flex items-center gap-2">
          <ShieldCheck size={18} className="text-emerald-400" />
          CarbonRoute MRV Architecture & Persona Security
        </h4>
        <div className="requirements-grid">
          <div className="req-item">
            <div className="req-icon">👤</div>
            <div className="req-text">
              <strong>Generator:</strong> Access strictly scoped to <code>Waste Registration</code>.
            </div>
          </div>
          <div className="req-item">
            <div className="req-icon">🚚</div>
            <div className="req-text">
              <strong>Logistics Manager:</strong> Access strictly scoped to <code>Route Map</code> and <code>Audit Ledger</code>.
            </div>
          </div>
          <div className="req-item">
            <div className="req-icon">⚖️</div>
            <div className="req-text">
              <strong>Facility Operator:</strong> Access strictly scoped to <code>Intake Terminal</code>.
            </div>
          </div>
          <div className="req-item">
            <div className="req-icon">🏛️</div>
            <div className="req-text">
              <strong>City Executive:</strong> Access strictly scoped to <code>ESG Analytics</code> and <code>Carbon Simulator</code>.
            </div>
          </div>
        </div>
      </section>
    </AppLayout>
  );
};

