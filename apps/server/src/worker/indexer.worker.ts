import { parentPort, workerData } from "node:worker_threads";
import type { SseEvent } from "@game-library/shared";
import PQueue from "p-queue";
import { createAesGcmCipher, loadOrCreateMasterKey } from "../db/crypto.js";
import { openDatabase } from "../db/index.js";
import { IndexJobProcessor } from "./jobProcessor.js";
import type {
  MainToWorkerMessage,
  WorkerInitData,
  WorkerToMainMessage,
} from "./protocol.js";

const init = workerData as WorkerInitData;
const conn = openDatabase(init.dbPath, init.nativeBindingPath);
const cipher = createAesGcmCipher(loadOrCreateMasterKey(init.masterKeyPath));
const jobQueue = new PQueue({ concurrency: 1 });

function emitSse(event: SseEvent): void {
  const msg: WorkerToMainMessage = { type: "sse", event };
  parentPort?.postMessage(msg);
}

const processor = new IndexJobProcessor({
  db: conn.db,
  sqlite: conn.sqlite,
  coversDir: init.coversDir,
  cipher,
  emitEvent: emitSse,
});

parentPort?.on("message", (msg: MainToWorkerMessage) => {
  if (msg.type === "enqueue_job") {
    void jobQueue.add(() =>
      processor.processJob(msg.jobId, msg.kind, msg.gameIds, msg.force)
    );
  } else if (msg.type === "cancel_job") {
    processor.cancelJob(msg.jobId);
  } else if (msg.type === "shutdown") {
    processor.beginShutdown();
    jobQueue.clear();
    conn.sqlite.close();
    process.exit(0);
  }
});

parentPort?.postMessage({ type: "ready" } satisfies WorkerToMainMessage);
