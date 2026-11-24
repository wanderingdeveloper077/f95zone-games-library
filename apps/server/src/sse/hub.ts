import type { ServerResponse } from "node:http";
import type { SseEvent } from "@game-library/shared";
import type { EventBroadcaster, SseClientRegistry } from "../contracts/ports.js";

interface SseClient {
  id: number;
  res: ServerResponse;
  heartbeat: NodeJS.Timeout;
}

/**
 * Manages active SSE response streams and broadcasts worker/API events.
 */
export class SseHub implements EventBroadcaster, SseClientRegistry {
  private readonly clients = new Set<SseClient>();
  private nextClientId = 1;
  private nextEventId = 1;

  get clientCount(): number {
    return this.clients.size;
  }

  addClient(res: ServerResponse, originHeader?: string): void {
    const headers: Record<string, string> = {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    };
    if (originHeader) {
      headers["Access-Control-Allow-Origin"] = originHeader;
      headers.Vary = "Origin";
    }

    res.writeHead(200, headers);

    const clientId = this.nextClientId++;
    const heartbeat = setInterval(() => {
      if (!res.writableEnded) {
        res.write(": keepalive\n\n");
      }
    }, 25_000);

    const client: SseClient = { id: clientId, res, heartbeat };
    this.clients.add(client);

    const cleanup = () => {
      clearInterval(heartbeat);
      this.clients.delete(client);
    };

    res.on("close", cleanup);
    res.on("error", cleanup);

    this.writeToClient(client, {
      type: "connected",
      serverTimeMs: Date.now(),
    });
  }

  broadcast(event: SseEvent): void {
    for (const client of this.clients) {
      this.writeToClient(client, event);
    }
  }

  closeAll(): void {
    for (const client of this.clients) {
      clearInterval(client.heartbeat);
      if (!client.res.writableEnded) {
        client.res.end();
      }
    }
    this.clients.clear();
  }

  private writeToClient(client: SseClient, event: SseEvent): void {
    if (client.res.writableEnded) return;
    const id = this.nextEventId++;
    const payload = `id: ${id}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
    client.res.write(payload);
  }
}
