import { extractThreadMatches } from "@game-library/shared";
import { browser } from "wxt/browser";
import { useEffect, useState } from "react";
import type { ExtensionActionResult, ExtensionRequest } from "../../lib/messaging";

interface PopupViewState {
  serverPort: number;
  isPaired: boolean;
  serverReachable: boolean;
  lastSessionSyncAtMs: number | null;
  lastSessionStatus: string | null;
  lastError: string | null;
}

async function sendBg<T = unknown>(
  msg: ExtensionRequest
): Promise<ExtensionActionResult<T>> {
  return (await browser.runtime.sendMessage(msg)) as ExtensionActionResult<T>;
}

export function App() {
  const [state, setState] = useState<PopupViewState | null>(null);
  const [portInput, setPortInput] = useState("57095");
  const [codeInput, setCodeInput] = useState("");
  const [tokenInput, setTokenInput] = useState("");
  const [activeTabUrl, setActiveTabUrl] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadState = async () => {
    const res = await sendBg<PopupViewState>({ type: "GET_EXTENSION_STATE" });
    if (res.ok && res.data) {
      setState(res.data);
      setPortInput(String(res.data.serverPort));
    }
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    setActiveTabUrl(tabs[0]?.url ?? "");
  };

  useEffect(() => {
    void loadState();
  }, []);

  const canAddActiveTab = extractThreadMatches(activeTabUrl).length > 0;

  const runAction = async (fn: () => Promise<ExtensionActionResult>, okMsg: string) => {
    setBusy(true);
    try {
      const res = await fn();
      setFeedback(res.ok ? okMsg : res.error || "Action failed");
      await loadState();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container">
      <div className="header">
        <div className="brand">
          <img src="/icon/32.png" alt="" className="brand-icon" />
          <span className="title">Game Library Companion</span>
        </div>
        <span className={`pill ${state?.serverReachable ? "pill-ok" : "pill-err"}`}>
          {state?.serverReachable ? "Server Online" : "Offline"}
        </span>
      </div>

      {feedback && <div className="status-msg">{feedback}</div>}

      <div className="card">
        <div className="label">Current Tab</div>
        <button
          type="button"
          className="primary"
          disabled={busy || !canAddActiveTab || !state?.isPaired}
          onClick={() =>
            void runAction(
              () => sendBg({ type: "ADD_GAME", url: activeTabUrl }),
              "Thread sent to Game Library!"
            )
          }
        >
          {canAddActiveTab ? "Add Current F95zone Thread" : "Open an F95zone Thread"}
        </button>

        <div className="row">
          <button
            type="button"
            style={{ flex: 1 }}
            disabled={busy || !state?.isPaired}
            onClick={() =>
              void runAction(
                () => sendBg({ type: "SYNC_SESSION" }),
                "F95zone cookies synced securely!"
              )
            }
          >
            Sync Session Now
          </button>
          <button
            type="button"
            onClick={() =>
              void browser.tabs.create({
                url: `http://127.0.0.1:${state?.serverPort ?? 57095}`,
              })
            }
          >
            Dashboard
          </button>
        </div>

        <div className="label">
          Session: {state?.lastSessionStatus ?? "Not synced"}
          {state?.lastSessionSyncAtMs
            ? ` (${new Date(state.lastSessionSyncAtMs).toLocaleTimeString()})`
            : ""}
        </div>
      </div>

      <div className="card">
        <div className="label">
          Pairing ({state?.isPaired ? "Paired" : "Not Paired"})
        </div>
        <div className="row">
          <input
            type="text"
            placeholder="6-char pairing code"
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
          />
          <button
            type="button"
            disabled={busy || codeInput.trim().length < 4}
            onClick={() =>
              void runAction(
                () => sendBg({ type: "PAIR_WITH_CODE", code: codeInput.trim() }),
                "Paired and synced!"
              )
            }
          >
            Pair
          </button>
        </div>

        <div className="row">
          <input
            type="password"
            placeholder="Or paste raw Pairing Token"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
          />
          <button
            type="button"
            disabled={busy || tokenInput.trim().length < 16}
            onClick={() =>
              void runAction(
                () =>
                  sendBg({
                    type: "SET_PAIRING_TOKEN",
                    token: tokenInput.trim(),
                  }),
                "Token saved!"
              )
            }
          >
            Save
          </button>
        </div>
      </div>

      <div className="card">
        <div className="label">Local Server Port</div>
        <div className="row">
          <input
            type="number"
            value={portInput}
            onChange={(e) => setPortInput(e.target.value)}
          />
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              void runAction(
                () =>
                  sendBg({
                    type: "SET_SERVER_PORT",
                    port: Number.parseInt(portInput, 10) || 57095,
                  }),
                "Port updated!"
              )
            }
          >
            Update
          </button>
        </div>
      </div>
    </div>
  );
}
