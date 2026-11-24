import axios, { type AxiosInstance } from "axios";

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "").replace(
  /\/+$/,
  ""
);

export const PAIRING_TOKEN_STORAGE_KEY = "gl_pairing_token";

export interface NormalizedApiError {
  status: number | null;
  code: string;
  message: string;
  details?: unknown;
}

export class ApiClientError extends Error {
  readonly status: number | null;
  readonly code: string;
  readonly details?: unknown;

  constructor(normalized: NormalizedApiError) {
    super(normalized.message);
    this.name = "ApiClientError";
    this.status = normalized.status;
    this.code = normalized.code;
    this.details = normalized.details;
  }
}

export function toNormalizedApiError(err: unknown): NormalizedApiError {
  if (err instanceof ApiClientError) {
    return {
      status: err.status,
      code: err.code,
      message: err.message,
      ...(err.details !== undefined ? { details: err.details } : {}),
    };
  }

  if (axios.isAxiosError(err)) {
    const status = err.response?.status ?? null;
    const data = err.response?.data as
      | { error?: { code?: string; message?: string; details?: unknown } }
      | undefined;

    if (data?.error?.message) {
      return {
        status,
        code: data.error.code ?? (status ? `HTTP_${status}` : "API_ERROR"),
        message: data.error.message,
        ...(data.error.details !== undefined
          ? { details: data.error.details }
          : {}),
      };
    }

    if (err.code === "ECONNABORTED") {
      return {
        status,
        code: "REQUEST_TIMEOUT",
        message: "The request timed out while waiting for the local server.",
      };
    }

    if (!err.response) {
      return {
        status: null,
        code: "NETWORK_ERROR",
        message: err.message || "Unable to reach the local server.",
      };
    }

    return {
      status,
      code: status ? `HTTP_${status}` : "API_ERROR",
      message: err.message || `Request failed with status ${status}`,
    };
  }

  if (err instanceof Error) {
    return {
      status: null,
      code: "CLIENT_ERROR",
      message: err.message,
    };
  }

  return {
    status: null,
    code: "UNKNOWN_ERROR",
    message: "An unexpected error occurred.",
  };
}

export type TokenProvider = () => string | null;

export interface ApiClientOptions {
  baseURL?: string;
  timeoutMs?: number;
  getPairingToken?: TokenProvider;
}

export function getBrowserPairingToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage?.getItem(PAIRING_TOKEN_STORAGE_KEY) ?? null;
  } catch {
    return null;
  }
}

export function createApiClient(options: ApiClientOptions = {}): AxiosInstance {
  const client = axios.create({
    baseURL: options.baseURL || undefined,
    timeout: options.timeoutMs ?? 30_000,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
  });

  if (options.getPairingToken) {
    const getToken = options.getPairingToken;
    client.interceptors.request.use((config) => {
      const token = getToken();
      if (token && !config.headers.has("X-Pairing-Token")) {
        config.headers.set("X-Pairing-Token", token);
      }
      return config;
    });
  }

  client.interceptors.response.use(
    (response) => response,
    (error: unknown) => Promise.reject(new ApiClientError(toNormalizedApiError(error)))
  );

  return client;
}

export const apiClient = createApiClient({
  baseURL: API_BASE_URL || undefined,
  getPairingToken: getBrowserPairingToken,
});
