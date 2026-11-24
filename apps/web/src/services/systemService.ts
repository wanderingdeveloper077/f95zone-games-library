import type {
  AccountStatus,
  AppSettings,
  IndexJob,
  PairingCodeResponse,
  PairingStatus,
  PickFileResponse,
  UpdateAppSettings,
} from "@game-library/shared";
import { apiClient } from "./api";

export async function getAccounts(): Promise<AccountStatus[]> {
  const { data } = await apiClient.get<{ accounts: AccountStatus[] }>(
    "/api/accounts"
  );
  return data.accounts;
}

export async function verifyF95Account(): Promise<{
  account: AccountStatus;
  error?: { flag: string; details?: string };
}> {
  const { data } = await apiClient.post<{
    account: AccountStatus;
    error?: { flag: string; details?: string };
  }>("/api/accounts/f95zone/verify");
  return data;
}

export async function clearF95Account(): Promise<AccountStatus> {
  const { data } = await apiClient.delete<{ account: AccountStatus }>(
    "/api/accounts/f95zone"
  );
  return data.account;
}

export async function getPairingStatus(): Promise<PairingStatus> {
  const { data } = await apiClient.get<PairingStatus>("/api/pairing/status");
  return data;
}

export async function createPairingCode(): Promise<PairingCodeResponse> {
  const { data } = await apiClient.post<PairingCodeResponse>(
    "/api/pairing/code"
  );
  return data;
}

export async function rotatePairingToken(): Promise<PairingStatus> {
  const { data } = await apiClient.post<PairingStatus>("/api/pairing/rotate");
  return data;
}

export async function getSettings(): Promise<AppSettings> {
  const { data } = await apiClient.get<{ settings: AppSettings }>(
    "/api/settings"
  );
  return data.settings;
}

export async function updateSettings(
  patch: UpdateAppSettings
): Promise<AppSettings> {
  const { data } = await apiClient.patch<{ settings: AppSettings }>(
    "/api/settings",
    patch
  );
  return data.settings;
}

export async function getJobs(): Promise<IndexJob[]> {
  const { data } = await apiClient.get<{ jobs: IndexJob[] }>("/api/jobs");
  return data.jobs;
}

export async function cancelJob(id: string): Promise<{ cancelling: boolean }> {
  const { data } = await apiClient.post<{ cancelling: boolean }>(
    `/api/jobs/${id}/cancel`
  );
  return data;
}

export async function pickLocalPath(
  mode: "file" | "folder",
  title?: string
): Promise<string | null> {
  const { data } = await apiClient.post<PickFileResponse>(
    "/api/system/pick-file",
    { mode, title }
  );
  return data.path;
}

export interface SystemService {
  getAccounts: typeof getAccounts;
  verifyF95Account: typeof verifyF95Account;
  clearF95Account: typeof clearF95Account;
  getPairingStatus: typeof getPairingStatus;
  createPairingCode: typeof createPairingCode;
  rotatePairingToken: typeof rotatePairingToken;
  getSettings: typeof getSettings;
  updateSettings: typeof updateSettings;
  getJobs: typeof getJobs;
  cancelJob: typeof cancelJob;
  pickLocalPath: typeof pickLocalPath;
}

export const systemService: SystemService = {
  getAccounts,
  verifyF95Account,
  clearF95Account,
  getPairingStatus,
  createPairingCode,
  rotatePairingToken,
  getSettings,
  updateSettings,
  getJobs,
  cancelJob,
  pickLocalPath,
};
