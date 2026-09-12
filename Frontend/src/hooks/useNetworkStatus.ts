import { useState, useEffect, useCallback } from 'react';

// Shared state for manual simulation override
let simulatedOffline: boolean | null = null;
const listeners = new Set<() => void>();

function notifyStatusChange() {
  listeners.forEach((fn) => fn());
}

export function setSimulatedNetworkStatus(isOffline: boolean | null) {
  simulatedOffline = isOffline;
  notifyStatusChange();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(isOffline ? 'offline' : 'online'));
  }
}

export function getSimulatedNetworkStatus(): boolean | null {
  return simulatedOffline;
}

export function useNetworkStatus() {
  const [isBrowserOnline, setIsBrowserOnline] = useState<boolean>(() => {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  });

  const [simulatedState, setSimulatedState] = useState<boolean | null>(simulatedOffline);

  useEffect(() => {
    const handleOnline = () => setIsBrowserOnline(true);
    const handleOffline = () => setIsBrowserOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const handleSimChange = () => {
      setSimulatedState(simulatedOffline);
    };
    listeners.add(handleSimChange);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      listeners.delete(handleSimChange);
    };
  }, []);

  const toggleSimulatedOffline = useCallback((forceOffline?: boolean) => {
    if (forceOffline !== undefined) {
      setSimulatedNetworkStatus(forceOffline ? true : null);
    } else {
      setSimulatedNetworkStatus(simulatedOffline === true ? null : true);
    }
  }, []);

  // Effective online status: browser online unless simulated offline
  const isOnline = simulatedState === true ? false : isBrowserOnline;

  return {
    isOnline,
    isSimulatedOffline: simulatedState === true,
    toggleSimulatedOffline,
    setSimulatedOffline: (val: boolean | null) => setSimulatedNetworkStatus(val),
  };
}
