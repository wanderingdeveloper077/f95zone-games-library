import type {
  AccountStatus,
  CookieItem,
  ExtensionBootstrapResponse,
  PairingExchangeResponse,
} from "@game-library/shared";

function baseUrl(port: number): string {
  return `http://127.0.0.1:${port}`;
}

async function serverFetch<T>(
  port: number,
  path: string,
  init: RequestInit & { pairingToken?: string }
): Promise<T> {
  const headers: Record<string, string> = {
    ...(init.body ? { "Content-Type": "application/json" } : {}),
    ...(init.pairingToken ? { "X-Pairing-Token": init.pairingToken } : {}),
  };

  const res = await fetch(`${baseUrl(port)}${path}`, {
    ...init,
    headers,
  });

  const payload = (await res.json().catch(() => ({}))) as {
    error?: { message?: string };
  } & T;

  if (!res.ok) {
    throw new Error(payload.error?.message || `HTTP ${res.status}`);
  }
  return payload;
}

export async function checkServerHealth(port: number): Promise<boolean> {
  try {
    const res = await fetch(`${baseUrl(port)}/api/health`);
    return res.ok;
  } catch {
    return false;
  }
}

export async function exchangePairingCode(
  port: number,
  code: string
): Promise<PairingExchangeResponse> {
  return serverFetch(port, "/api/pairing/exchange", {
    method: "POST",
    body: JSON.stringify({ code }),
  });
}

export async function fetchBootstrap(
  port: number,
  pairingToken: string
): Promise<ExtensionBootstrapResponse> {
  return serverFetch(port, "/api/extension/bootstrap", {
    method: "GET",
    pairingToken,
  });
}

export async function postAddGames(
  port: number,
  pairingToken: string,
  urls: string[]
): Promise<{ added: Array<{ id: number; name: string }>; duplicateIds: number[] }> {
  return serverFetch(port, "/api/extension/add", {
    method: "POST",
    pairingToken,
    body: JSON.stringify({ urls }),
  });
}

export async function postF95Session(
  port: number,
  pairingToken: string,
  payload: { cookies: CookieItem[]; userAgent: string }
): Promise<{ account: AccountStatus }> {
  return serverFetch(port, "/api/accounts/f95zone/session", {
    method: "POST",
    pairingToken,
    body: JSON.stringify(payload),
  });
}
