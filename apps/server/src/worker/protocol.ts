import type { IndexJobKind, SseEvent } from "@game-library/shared";

export interface WorkerInitData {
  dbPath: string;
  coversDir: string;
  masterKeyPath: string;
  nativeBindingPath?: string;
}

export type MainToWorkerMessage =
  | {
      type: "enqueue_job";
      jobId: string;
      kind: IndexJobKind;
      gameIds?: number[];
      force?: boolean;
    }
  | {
      type: "cancel_job";
      jobId: string;
    }
  | {
      type: "shutdown";
    };

export type WorkerToMainMessage =
  | {
      type: "sse";
      event: SseEvent;
    }
  | {
      type: "ready";
    }
  | {
      type: "error";
      message: string;
    };
