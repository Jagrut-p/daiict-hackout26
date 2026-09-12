import React, { useState } from 'react';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { mockServer, MockBehaviorMode } from '../services/mockApi';
import { Wifi, WifiOff, Server, Sliders, ShieldAlert, CheckCircle } from 'lucide-react';

export const NetworkSimulator: React.FC = () => {
  const { isOnline, isSimulatedOffline, toggleSimulatedOffline } = useNetworkStatus();
  const [currentMode, setCurrentMode] = useState<MockBehaviorMode>(mockServer.getMode());
  const [latency, setLatency] = useState<number>(mockServer.getLatency());

  const handleModeChange = (mode: MockBehaviorMode) => {
    setCurrentMode(mode);
    mockServer.setMode(mode);
  };

  const handleLatencyChange = (ms: number) => {
    setLatency(ms);
    mockServer.setLatency(ms);
  };

  return (
    <div className="card simulator-card">
      <div className="simulator-header">
        <div className="flex items-center gap-2">
          <Sliders size={20} className="text-cyan-400" />
          <h3 className="card-title text-base font-bold">Interactive Test Controls & Simulation</h3>
        </div>
        <span className="badge-pill badge-info">Evaluation Tools</span>
      </div>

      <p className="text-sm text-slate-300 mb-4">
        Toggle simulated offline mode or force specific server HTTP responses to test all 4 test cases easily:
      </p>

      <div className="simulator-grid">
        {/* Network State Toggle */}
        <div className="sim-control-box">
          <div className="sim-box-header">
            <span className="sim-box-title">
              {isOnline ? <Wifi size={16} className="text-emerald-400" /> : <WifiOff size={16} className="text-amber-400" />}
              Network Connectivity
            </span>
            <span className={`status-tag ${isOnline ? 'tag-online' : 'tag-offline'}`}>
              {isOnline ? 'Online' : 'Offline'}
            </span>
          </div>

          <p className="text-xs text-slate-400 mb-3">
            {isSimulatedOffline
              ? 'Network is currently simulated as OFFLINE. Form submissions will queue in IndexedDB.'
              : 'Network is active. Submissions will attempt direct POST to /shipments/sync.'}
          </p>

          <button
            type="button"
            id="toggle-network-status-btn"
            onClick={() => toggleSimulatedOffline()}
            className={`btn-sim ${isSimulatedOffline ? 'btn-sim-reconnect' : 'btn-sim-offline'}`}
          >
            {isSimulatedOffline ? (
              <>
                <Wifi size={16} />
                <span>Restore Network (Test Case 2: Auto-Sync Queue)</span>
              </>
            ) : (
              <>
                <WifiOff size={16} />
                <span>Simulate Going Offline (Test Case 1)</span>
              </>
            )}
          </button>
        </div>

        {/* Server Response Mode Switcher */}
        <div className="sim-control-box">
          <div className="sim-box-header">
            <span className="sim-box-title">
              <Server size={16} className="text-purple-400" />
              Mock /shipments/sync HTTP Response
            </span>
            <span className="status-tag tag-purple font-mono">
              {currentMode.toUpperCase()}
            </span>
          </div>

          <div className="mode-button-group">
            <button
              type="button"
              id="mode-auto-btn"
              onClick={() => handleModeChange('auto')}
              className={`mode-btn ${currentMode === 'auto' ? 'mode-btn-active' : ''}`}
              title="201 for new, 200 for idempotency"
            >
              <CheckCircle size={14} />
              Auto (201/200)
            </button>

            <button
              type="button"
              id="mode-force-200-btn"
              onClick={() => handleModeChange('force_200')}
              className={`mode-btn ${currentMode === 'force_200' ? 'mode-btn-active' : ''}`}
              title="Force 200 OK (Idempotent Success)"
            >
              200 OK (TC 3)
            </button>

            <button
              type="button"
              id="mode-force-201-btn"
              onClick={() => handleModeChange('force_201')}
              className={`mode-btn ${currentMode === 'force_201' ? 'mode-btn-active' : ''}`}
              title="Force 201 Created"
            >
              201 Created (TC 3)
            </button>

            <button
              type="button"
              id="mode-force-409-btn"
              onClick={() => handleModeChange('force_409')}
              className={`mode-btn mode-btn-danger ${currentMode === 'force_409' ? 'mode-btn-active' : ''}`}
              title="Force 409 Conflict (Duplicate Claim)"
            >
              <ShieldAlert size={14} />
              409 Conflict (TC 4)
            </button>

            <button
              type="button"
              id="mode-force-500-btn"
              onClick={() => handleModeChange('force_500')}
              className={`mode-btn mode-btn-warn ${currentMode === 'force_500' ? 'mode-btn-active' : ''}`}
              title="Force 500 Internal Error"
            >
              500 Error
            </button>
          </div>

          {/* Latency Slider */}
          <div className="latency-row mt-3">
            <span className="text-xs text-slate-400">Artificial Latency: <strong>{latency}ms</strong></span>
            <input
              type="range"
              min="0"
              max="1500"
              step="100"
              value={latency}
              onChange={(e) => handleLatencyChange(Number(e.target.value))}
              className="latency-slider"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
