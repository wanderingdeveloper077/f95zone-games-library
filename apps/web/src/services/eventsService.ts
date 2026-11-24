import type { SseEvent } from "@game-library/shared";

export interface EventSourceLike {
  addEventListener(type: string, listener: (event: Event) => void): void;
  close(): void;
  onopen: ((ev: Event) => unknown) | null;
  onerror: ((ev: Event) => unknown) | null;
}

export type EventSourceFactory = (url: string) => EventSourceLike;

export interface SseEventHandlers {
  onOpen?: () => void;
  onError?: () => void;
  onEvent: (event: SseEvent) => void;
}

export const SSE_EVENT_TYPES: ReadonlyArray<SseEvent["type"]> = [
  "connected",
  "job_started",
  "job_progress",
  "job_completed",
  "job_failed",
  "game_updated",
  "games_added",
  "account_updated",
];

export function subscribeToEvents(
  url: string,
  handlers: SseEventHandlers,
  createEventSource: EventSourceFactory = (targetUrl) => new EventSource(targetUrl)
): () => void {
  const source = createEventSource(url);

  for (const name of SSE_EVENT_TYPES) {
    source.addEventListener(name, (raw) => {
      const payload = (raw as { data?: unknown }).data;
      if (typeof payload !== "string") return;
      try {
        const parsed = JSON.parse(payload) as SseEvent;
        handlers.onEvent(parsed);
      } catch {
        // Ignore malformed SSE payload
      }
    });
  }

  source.onopen = () => {
    handlers.onOpen?.();
  };

  source.onerror = () => {
    handlers.onError?.();
  };

  return () => {
    source.close();
  };
}
