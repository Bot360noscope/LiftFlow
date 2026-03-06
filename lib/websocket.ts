import { Platform } from "react-native";

type WSListener = (event: any) => void;

let ws: WebSocket | null = null;
let registeredProfileId: string | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<WSListener>();

function getWsUrl(): string {
  const domain = process.env.EXPO_PUBLIC_DOMAIN || '';
  if (!domain) return '';
  const host = domain.replace(/:5000$/, '');
  const protocol = Platform.OS === 'web' ? (window.location.protocol === 'https:' ? 'wss' : 'ws') : 'wss';
  return `${protocol}://${host}/ws`;
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
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      for (const listener of listeners) {
        try { listener(data); } catch {}
      }
    } catch {}
  };

  ws.onclose = () => {
    ws = null;
    scheduleReconnect(profileId);
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

export function connectWebSocket(profileId: string) {
  if (registeredProfileId === profileId && ws && ws.readyState === WebSocket.OPEN) return;
  registeredProfileId = profileId;
  if (ws) {
    try { ws.close(); } catch {}
    ws = null;
  }
  connect(profileId);
}

export function disconnectWebSocket() {
  registeredProfileId = null;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (ws) {
    try { ws.close(); } catch {}
    ws = null;
  }
}

export function addWSListener(fn: WSListener) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}
