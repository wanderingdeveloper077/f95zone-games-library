import { extractThreadMatches } from "@game-library/shared";
import { browser, defineBackground } from "#imports";
import {
  checkServerHealth,
  exchangePairingCode,
  fetchBootstrap,
  postAddGames,
  postF95Session,
} from "../lib/api";
import { extractF95SessionPayload } from "../lib/cookies";
import type {
  BackgroundPushMessage,
  ExtensionActionResult,
  ExtensionRequest,
} from "../lib/messaging";
import { getStoredState, updateStoredState } from "../lib/storage";

const ALARM_NAME = "refresh-library-bootstrap";
const WATCHED_COOKIE_NAMES = new Set([
  "xf_user",
  "xf_tfa_trust",
  "xf_session",
  "cf_clearance",
]);

let cookieSyncDebounce: ReturnType<typeof setTimeout> | null = null;

function getBadgeApi() {
  return (
    browser.action ??
    (browser as unknown as { browserAction?: typeof browser.action })
      .browserAction
  );
}

async function setExtensionBadge(text: string, color: string): Promise<void> {
  const api = getBadgeApi();
  if (!api) return;
  try {
    await api.setBadgeText({ text });
    await api.setBadgeBackgroundColor({ color });
  } catch {
    // Ignore unsupported badge calls
  }
}

async function notifyF95Tabs(message: BackgroundPushMessage): Promise<void> {
  try {
    const tabs = await browser.tabs.query({ url: "*://*.f95zone.to/*" });
    await Promise.all(
      tabs
        .filter((t) => typeof t.id === "number")
        .map((t) => browser.tabs.sendMessage(t.id!, message).catch(() => undefined))
    );
  } catch {
    // Ignore tab query failures
  }
}

async function syncBootstrapData(): Promise<ExtensionActionResult> {
  const state = await getStoredState();
  if (!state.pairingToken) {
    await setExtensionBadge("PAIR", "#d97706");
    return { ok: false, error: "Extension is not paired with local server." };
  }
  try {
    const data = await fetchBootstrap(state.serverPort, state.pairingToken);
    await updateStoredState({
      cachedBootstrap: data,
      cachedAtMs: Date.now(),
      lastError: null,
    });
    await setExtensionBadge("", "#16a34a");
    await notifyF95Tabs({ type: "LIBRARY_UPDATED", data });
    return { ok: true, data };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Server unreachable";
    await updateStoredState({ lastError: msg });
    await setExtensionBadge("ERR", "#dc2626");
    return { ok: false, error: msg };
  }
}

async function syncSessionNow(): Promise<ExtensionActionResult> {
  const state = await getStoredState();
  if (!state.pairingToken) {
    return { ok: false, error: "Pair extension before syncing cookies." };
  }
  try {
    const payload = await extractF95SessionPayload();
    if (payload.cookies.length === 0) {
      return { ok: false, error: "No f95zone.to cookies found in browser." };
    }
    const res = await postF95Session(
      state.serverPort,
      state.pairingToken,
      payload
    );
    await updateStoredState({
      lastSessionSyncAtMs: Date.now(),
      lastSessionStatus: res.account.status,
      lastError: null,
    });
    await setExtensionBadge("", "#16a34a");
    return { ok: true, data: res.account };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Session sync failed";
    await updateStoredState({ lastError: msg });
    await setExtensionBadge("ERR", "#dc2626");
    return { ok: false, error: msg };
  }
}

async function addThreadUrl(
  url: string,
  tabId?: number
): Promise<ExtensionActionResult> {
  const state = await getStoredState();
  if (!state.pairingToken) {
    if (tabId !== undefined) {
      await browser.tabs
        .sendMessage(tabId, {
          type: "TOAST",
          message: "Please pair the extension with your Game Library server first.",
          level: "error",
        } satisfies BackgroundPushMessage)
        .catch(() => undefined);
    }
    return { ok: false, error: "Extension is not paired." };
  }
  const matches = extractThreadMatches(url);
  if (matches.length === 0) {
    if (tabId !== undefined) {
      await browser.tabs
        .sendMessage(tabId, {
          type: "TOAST",
          message: "No F95zone thread ID found on this URL.",
          level: "error",
        } satisfies BackgroundPushMessage)
        .catch(() => undefined);
    }
    return { ok: false, error: "Not an F95zone thread URL." };
  }
  try {
    const res = await postAddGames(state.serverPort, state.pairingToken, [url]);
    await syncBootstrapData();
    const label =
      res.added.length > 0
        ? `Added ${res.added[0]!.name} to Game Library.`
        : "Thread is already in your Game Library.";
    if (tabId !== undefined) {
      await browser.tabs
        .sendMessage(tabId, {
          type: "TOAST",
          message: label,
          level: "info",
        } satisfies BackgroundPushMessage)
        .catch(() => undefined);
    }
    return { ok: true, data: res };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to add game";
    if (tabId !== undefined) {
      await browser.tabs
        .sendMessage(tabId, {
          type: "TOAST",
          message: `Error: ${msg}`,
          level: "error",
        } satisfies BackgroundPushMessage)
        .catch(() => undefined);
    }
    return { ok: false, error: msg };
  }
}

async function registerContextMenusAndAlarms(): Promise<void> {
  try {
    await browser.contextMenus.removeAll();
    browser.contextMenus.create({
      id: "add-page-to-library",
      title: "Add this thread to Game Library",
      contexts: ["page"],
      documentUrlPatterns: ["*://*.f95zone.to/threads/*"],
    });
    browser.contextMenus.create({
      id: "add-link-to-library",
      title: "Add this thread link to Game Library",
      contexts: ["link"],
      targetUrlPatterns: ["*://*.f95zone.to/threads/*"],
    });
  } catch {
    // Ignore context menu registration errors if unsupported
  }

  await browser.alarms.create(ALARM_NAME, { periodInMinutes: 5 });
}

export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(() => {
    void registerContextMenusAndAlarms().then(() => syncBootstrapData());
  });

  browser.runtime.onStartup.addListener(() => {
    void browser.alarms.create(ALARM_NAME, { periodInMinutes: 5 });
    void syncBootstrapData();
  });

  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === ALARM_NAME) {
      void syncBootstrapData();
    }
  });

  browser.contextMenus.onClicked.addListener((info, tab) => {
    const targetUrl = info.linkUrl || info.pageUrl;
    if (targetUrl) {
      void addThreadUrl(targetUrl, tab?.id);
    }
  });

  browser.cookies.onChanged.addListener((changeInfo) => {
    const cookie = changeInfo.cookie;
    if (!cookie.domain.includes("f95zone.to")) return;
    if (!WATCHED_COOKIE_NAMES.has(cookie.name) && changeInfo.removed) return;

    if (cookieSyncDebounce) {
      clearTimeout(cookieSyncDebounce);
    }
    cookieSyncDebounce = setTimeout(() => {
      void getStoredState().then((state) => {
        if (state.pairingToken) {
          return syncSessionNow();
        }
        return undefined;
      });
    }, 2000);
  });

  browser.runtime.onMessage.addListener((rawMsg, _sender, sendResponse) => {
    const msg = rawMsg as ExtensionRequest;

    const handle = async (): Promise<ExtensionActionResult> => {
      switch (msg.type) {
        case "GET_PAGE_DATA": {
          const state = await getStoredState();
          if (state.cachedBootstrap) {
            return { ok: true, data: state.cachedBootstrap };
          }
          return syncBootstrapData();
        }
        case "ADD_GAME":
          return addThreadUrl(msg.url);
        case "SYNC_SESSION":
          return syncSessionNow();
        case "REFRESH_BOOTSTRAP":
          return syncBootstrapData();
        case "PAIR_WITH_CODE": {
          const state = await getStoredState();
          try {
            const { pairingToken } = await exchangePairingCode(
              state.serverPort,
              msg.code
            );
            await updateStoredState({ pairingToken, lastError: null });
            await syncSessionNow();
            await syncBootstrapData();
            return { ok: true };
          } catch (err) {
            const error =
              err instanceof Error ? err.message : "Pairing failed";
            await updateStoredState({ lastError: error });
            return { ok: false, error };
          }
        }
        case "SET_PAIRING_TOKEN": {
          await updateStoredState({
            pairingToken: msg.token.trim(),
            lastError: null,
          });
          await syncSessionNow();
          await syncBootstrapData();
          return { ok: true };
        }
        case "SET_SERVER_PORT": {
          const port =
            Number.isInteger(msg.port) && msg.port > 0 && msg.port <= 65535
              ? msg.port
              : 57095;
          await updateStoredState({ serverPort: port });
          return { ok: true, data: { serverPort: port } };
        }
        case "GET_EXTENSION_STATE": {
          const state = await getStoredState();
          const serverReachable = await checkServerHealth(state.serverPort);
          return {
            ok: true,
            data: {
              ...state,
              pairingToken: state.pairingToken ? "***configured***" : "",
              isPaired: Boolean(state.pairingToken),
              serverReachable,
            },
          };
        }
        default:
          return { ok: false, error: "Unknown message type." };
      }
    };

    void handle().then(sendResponse);
    return true;
  });
});
