import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";
import type { IncomingMessage } from "http";

const PING_INTERVAL = 30_000;
const PONG_TIMEOUT = 10_000;

const profileConnections = new Map<string, Set<WebSocket>>();
const aliveMap = new WeakMap<WebSocket, boolean>();

function removeConnection(ws: WebSocket, profileId: string | null) {
  if (profileId && profileConnections.has(profileId)) {
    profileConnections.get(profileId)!.delete(ws);
    if (profileConnections.get(profileId)!.size === 0) {
      profileConnections.delete(profileId);
    }
  }
}

export function setupWebSocket(server: Server) {
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws: WebSocket, _req: IncomingMessage) => {
    let profileId: string | null = null;
    aliveMap.set(ws, true);

    ws.on("pong", () => {
      aliveMap.set(ws, true);
    });

    ws.on("message", (data: Buffer) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === "register" && msg.profileId) {
          profileId = msg.profileId;
          if (!profileConnections.has(profileId!)) {
            profileConnections.set(profileId!, new Set());
          }
          profileConnections.get(profileId!)!.add(ws);
        }
        if (msg.type === "pong") {
          aliveMap.set(ws, true);
        }
      } catch {}
    });

    ws.on("close", () => {
      removeConnection(ws, profileId);
    });

    ws.on("error", () => {
      removeConnection(ws, profileId);
    });
  });

  const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (aliveMap.get(ws) === false) {
        ws.terminate();
        return;
      }
      aliveMap.set(ws, false);
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
        try {
          ws.send(JSON.stringify({ type: "ping" }));
        } catch {}
      }
    });
  }, PING_INTERVAL);

  wss.on("close", () => {
    clearInterval(heartbeatInterval);
  });

  return wss;
}

export function broadcastToProfile(profileId: string, event: Record<string, unknown>) {
  const connections = profileConnections.get(profileId);
  if (!connections) return;
  const payload = JSON.stringify(event);
  for (const ws of connections) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    }
  }
}
