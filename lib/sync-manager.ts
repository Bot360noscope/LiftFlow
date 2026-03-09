import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { flushQueue, getPendingCount, type QueueEntry } from './offline-queue';
import { apiPost, apiPut, apiDelete } from './api';

let _isOnline = true;
let _isSyncing = false;
let _pendingCount = 0;
const listeners: Set<() => void> = new Set();
let _onSyncComplete: (() => Promise<void>) | null = null;

function notify() {
  listeners.forEach(fn => fn());
}

export function getIsOnline(): boolean {
  return _isOnline;
}

export function registerSyncCallback(cb: () => Promise<void>) {
  _onSyncComplete = cb;
}

async function executeQueueEntry(entry: QueueEntry): Promise<boolean> {
  try {
    if (entry.method === 'POST') {
      await apiPost(entry.endpoint, entry.data);
    } else if (entry.method === 'PUT') {
      try {
        await apiPut(entry.endpoint, entry.data);
      } catch (e: any) {
        if (e.message?.includes('Coach has updated')) {
          return true;
        }
        throw e;
      }
    } else if (entry.method === 'DELETE') {
      await apiDelete(entry.endpoint);
    }
    return true;
  } catch {
    return false;
  }
}

async function syncNow(): Promise<void> {
  if (_isSyncing || !_isOnline) return;

  const count = await getPendingCount();
  _pendingCount = count;
  if (count === 0) {
    notify();
    return;
  }

  _isSyncing = true;
  notify();

  try {
    await flushQueue(executeQueueEntry);

    _pendingCount = await getPendingCount();

    if (_onSyncComplete) {
      try {
        await _onSyncComplete();
      } catch {}
    }
  } catch {} finally {
    _isSyncing = false;
    notify();
  }
}

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(_isOnline);
  const [isSyncing, setIsSyncing] = useState(_isSyncing);
  const [pendingCount, setPendingCount] = useState(_pendingCount);
  const wasOffline = useRef(false);
  const previousAppState = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    const update = () => {
      setIsOnline(_isOnline);
      setIsSyncing(_isSyncing);
      setPendingCount(_pendingCount);
    };
    listeners.add(update);

    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      const online = !!(state.isConnected && state.isInternetReachable !== false);

      if (!online && _isOnline) {
        wasOffline.current = true;
      }

      _isOnline = online;
      update();

      if (online && wasOffline.current) {
        wasOffline.current = false;
        syncNow();
      }
    });

    const appStateSub = AppState.addEventListener('change', (nextState) => {
      const prev = previousAppState.current;
      previousAppState.current = nextState;

      const isReturningToForeground =
        nextState === 'active' && (prev === 'background' || prev === 'inactive');

      if (isReturningToForeground && _isOnline) {
        syncNow();
      }
    });

    getPendingCount().then(count => {
      _pendingCount = count;
      update();
    });

    return () => {
      listeners.delete(update);
      unsubscribe();
      appStateSub.remove();
    };
  }, []);

  const triggerSync = useCallback(() => {
    syncNow();
  }, []);

  return { isOnline, isSyncing, pendingCount, triggerSync };
}
