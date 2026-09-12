import { useState, useEffect, useCallback } from 'react';
import { apiService, BackendHealthResponse } from '../services/apiService';

export interface BackendStatusState {
  isBackendOnline: boolean;
  latencyMs: number;
  stats?: BackendHealthResponse['stats'];
  version?: string;
  isChecking: boolean;
  lastChecked: Date | null;
  checkHealth: () => Promise<void>;
}

export function useBackendStatus(pollIntervalMs: number = 8000): BackendStatusState {
  const [isBackendOnline, setIsBackendOnline] = useState<boolean>(false);
  const [latencyMs, setLatencyMs] = useState<number>(0);
  const [stats, setStats] = useState<BackendHealthResponse['stats'] | undefined>(undefined);
  const [version, setVersion] = useState<string | undefined>(undefined);
  const [isChecking, setIsChecking] = useState<boolean>(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const checkHealth = useCallback(async () => {
    setIsChecking(true);
    const res = await apiService.checkHealth();
    setIsBackendOnline(res.online);
    setLatencyMs(res.latencyMs);
    if (res.online && res.data) {
      setStats(res.data.stats);
      setVersion(res.data.version);
    }
    setLastChecked(new Date());
    setIsChecking(false);
  }, []);

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, pollIntervalMs);
    return () => clearInterval(interval);
  }, [checkHealth, pollIntervalMs]);

  return {
    isBackendOnline,
    latencyMs,
    stats,
    version,
    isChecking,
    lastChecked,
    checkHealth,
  };
}
