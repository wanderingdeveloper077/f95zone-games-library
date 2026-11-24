import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Worker } from "node:worker_threads";
import type { IndexJobKind } from "@game-library/shared";
import type {
  EventBroadcaster,
  JobCanceller,
  JobDispatcher,
} from "../contracts/ports.js";
import type {
  MainToWorkerMessage,
  WorkerInitData,
  WorkerToMainMessage,
} from "./protocol.js";

export interface WorkerManagerInit extends WorkerInitData {
  workerScriptPath?: string;
}

export class IndexerWorkerManager implements JobDispatcher, JobCanceller {
  private worker: Worker | null = null;
  private readonly workerInit: WorkerManagerInit;
  private readonly broadcaster: EventBroadcaster;

  constructor(workerInit: WorkerManagerInit, broadcaster: EventBroadcaster) {
    this.workerInit = workerInit;
    this.broadcaster = broadcaster;
  }

  private resolveWorkerEntry(): { url: URL; execArgv?: string[] } {
    if (
      this.workerInit.workerScriptPath &&
      fs.existsSync(this.workerInit.workerScriptPath)
    ) {
      return { url: pathToFileURL(this.workerInit.workerScriptPath) };
    }
    const metaUrl =
      typeof import.meta?.url === "string" ? import.meta.url : "";
    const currentDir = metaUrl
      ? path.dirname(fileURLToPath(metaUrl))
      : process.cwd();
    const mjsCandidate = path.join(currentDir, "indexer.worker.mjs");
    if (fs.existsSync(mjsCandidate)) {
      return { url: pathToFileURL(mjsCandidate) };
    }
    const jsCandidate = path.join(currentDir, "indexer.worker.js");
    if (fs.existsSync(jsCandidate)) {
      return { url: pathToFileURL(jsCandidate) };
    }
    // Dev / Vitest running directly against .ts sources
    const tsCandidate = path.join(currentDir, "indexer.worker.ts");
    return {
      url: pathToFileURL(tsCandidate),
      execArgv: ["--import", "tsx"],
    };
  }

  start(): void {
    if (this.worker) return;
    const entry = this.resolveWorkerEntry();
    const workerData: WorkerInitData = {
      dbPath: this.workerInit.dbPath,
      coversDir: this.workerInit.coversDir,
      masterKeyPath: this.workerInit.masterKeyPath,
      ...(this.workerInit.nativeBindingPath
        ? { nativeBindingPath: this.workerInit.nativeBindingPath }
        : {}),
    };

    const worker = new Worker(entry.url, {
      workerData,
      ...(entry.execArgv ? { execArgv: entry.execArgv } : {}),
    });

    worker.on("message", (msg: WorkerToMainMessage) => {
      if (msg.type === "sse") {
        this.broadcaster.broadcast(msg.event);
      }
    });

    worker.on("error", (err) => {
      console.error("[indexer-worker] error:", err);
    });

    worker.on("exit", (code) => {
      if (code !== 0) {
        console.error(`[indexer-worker] exited with code ${code}`);
      }
      if (this.worker === worker) {
        this.worker = null;
      }
    });

    this.worker = worker;
  }

  enqueueJob(
    jobId: string,
    kind: IndexJobKind,
    gameIds?: number[],
    force = false
  ): void {
    if (!this.worker) {
      this.start();
    }
    const msg: MainToWorkerMessage = {
      type: "enqueue_job",
      jobId,
      kind,
      gameIds,
      force,
    };
    this.worker?.postMessage(msg);
  }

  cancelJob(jobId: string): void {
    if (!this.worker) return;
    const msg: MainToWorkerMessage = {
      type: "cancel_job",
      jobId,
    };
    this.worker.postMessage(msg);
  }

  async shutdown(): Promise<void> {
    const active = this.worker;
    if (!active) return;
    this.worker = null;

    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        void active.terminate().finally(resolve);
      }, 3000);

      active.once("exit", () => {
        clearTimeout(timeout);
        resolve();
      });

      active.postMessage({ type: "shutdown" } satisfies MainToWorkerMessage);
    });
  }
}
