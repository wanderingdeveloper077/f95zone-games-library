import {
  DEFAULT_SERVER_PORT,
  type ExtensionBootstrapResponse,
} from "@game-library/shared";
import { browser } from "wxt/browser";

export interface StoredExtensionState {
  serverPort: number;
  pairingToken: string;
  lastSessionSyncAtMs: number | null;
  lastSessionStatus: string | null;
  lastError: string | null;
  cachedBootstrap: ExtensionBootstrapResponse | null;
  cachedAtMs: number | null;
}

const DEFAULT_STATE: StoredExtensionState = {
  serverPort: DEFAULT_SERVER_PORT,
  pairingToken: "",
  lastSessionSyncAtMs: null,
  lastSessionStatus: null,
  lastError: null,
  cachedBootstrap: null,
  cachedAtMs: null,
};

const STORAGE_KEY = "gl_extension_state_v1";

export async function getStoredState(): Promise<StoredExtensionState> {
  const res = await browser.storage.local.get(STORAGE_KEY);
  const raw = res[STORAGE_KEY] as Partial<StoredExtensionState> | undefined;
  return {
    ...DEFAULT_STATE,
    ...(raw ?? {}),
  };
}

export async function updateStoredState(
  patch: Partial<StoredExtensionState>
): Promise<StoredExtensionState> {
  const current = await getStoredState();
  const next: StoredExtensionState = {
    ...current,
    ...patch,
  };
  await browser.storage.local.set({ [STORAGE_KEY]: next });
  return next;
}
