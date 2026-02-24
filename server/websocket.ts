import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";
import type { IncomingMessage } from "http";

const profileConnections = new Map<string, Set<WebSocket>>();

export function setupWebSocket(server: Server) {
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws: WebSocket, _req: IncomingMessage) => {
    let profileId: string | null = null;

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
      } catch {}
    });

    ws.on("close", () => {
      if (profileId && profileConnections.has(profileId)) {
        profileConnections.get(profileId)!.delete(ws);
        if (profileConnections.get(profileId)!.size === 0) {
          profileConnections.delete(profileId);
        }
      }
    });

    ws.on("error", () => {
      if (profileId && profileConnections.has(profileId)) {
        profileConnections.get(profileId)!.delete(ws);
      }
    });
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
