import { Platform, AppState, type AppStateStatus } from "react-native";

type WSListener = (event: any) => void;

let ws: WebSocket | null = null;
let registeredProfileId: string | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let staleCheckTimer: ReturnType<typeof setTimeout> | null = null;
let lastPingTime = 0;
let appStateSubscription: { remove: () => void } | null = null;
let previousAppState: AppStateStatus = AppState.currentState;
let intentionalClose = false;
const STALE_TIMEOUT = 45_000;
const listeners = new Set<WSListener>();

function getWsUrl(): string {
  const domain = process.env.EXPO_PUBLIC_DOMAIN || '';
  if (!domain) return '';
  const host = domain.replace(/:5000$/, '');
  const protocol = Platform.OS === 'web' ? (window.location.protocol === 'https:' ? 'wss' : 'ws') : 'wss';
  return `${protocol}://${host}/ws`;
}

function startStaleCheck(profileId: string) {
  stopStaleCheck();
  lastPingTime = Date.now();
  staleCheckTimer = setInterval(() => {
    if (ws && Date.now() - lastPingTime > STALE_TIMEOUT) {
      try { ws.close(); } catch {}
      ws = null;
      scheduleReconnect(profileId);
    }
  }, STALE_TIMEOUT);
}

function stopStaleCheck() {
  if (staleCheckTimer) {
    clearInterval(staleCheckTimer);
    staleCheckTimer = null;
  }
}

function connect(profileId: string) {
  const url = getWsUrl();
  if (!url) return;

  try {
    ws = new WebSocket(url);
  } catch {
    scheduleReconnect(profileId);
    return;
  }

  ws.onopen = () => {
    ws?.send(JSON.stringify({ type: 'register', profileId }));
    startStaleCheck(profileId);
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === 'ping') {
        lastPingTime = Date.now();
        ws?.send(JSON.stringify({ type: 'pong' }));
        return;
      }
      for (const listener of listeners) {
        try { listener(data); } catch {}
      }
    } catch {}
  };

  ws.onclose = () => {
    ws = null;
    stopStaleCheck();
    if (!intentionalClose) {
      scheduleReconnect(profileId);
    }
    intentionalClose = false;
  };

  ws.onerror = () => {
    try { ws?.close(); } catch {}
    ws = null;
  };
}

function scheduleReconnect(profileId: string) {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(() => {
    if (registeredProfileId === profileId) {
      connect(profileId);
    }
  }, 3000);
}

function handleAppStateChange(nextAppState: AppStateStatus) {
  if (!registeredProfileId) return;
  if (previousAppState.match(/active/) && nextAppState.match(/inactive|background/)) {
    stopStaleCheck();
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
    if (ws) { intentionalClose = true; try { ws.close(); } catch {} ws = null; }
  } else if (previousAppState.match(/inactive|background/) && nextAppState === 'active') {
    if (registeredProfileId && (!ws || ws.readyState !== WebSocket.OPEN)) {
      connect(registeredProfileId);
    }
  }
  previousAppState = nextAppState;
}

export function connectWebSocket(profileId: string) {
  if (registeredProfileId === profileId && ws && ws.readyState === WebSocket.OPEN) return;
  registeredProfileId = profileId;
  if (ws) {
    try { ws.close(); } catch {}
    ws = null;
  }
  connect(profileId);
  if (!appStateSubscription) {
    appStateSubscription = AppState.addEventListener('change', handleAppStateChange);
  }
}

export function disconnectWebSocket() {
  registeredProfileId = null;
  stopStaleCheck();
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (ws) {
    try { ws.close(); } catch {}
    ws = null;
  }
  if (appStateSubscription) {
    appStateSubscription.remove();
    appStateSubscription = null;
  }
}

export function addWSListener(fn: WSListener) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}
