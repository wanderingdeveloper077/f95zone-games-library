import type {
  AccountStatus,
  AppSettings,
  IndexJob,
  PairingStatus,
  UpdateAppSettings,
} from "@game-library/shared";
import { type PayloadAction, createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { type NormalizedApiError, toNormalizedApiError } from "@/services/api";
import {
  cancelJob,
  clearF95Account,
  createPairingCode,
  getAccounts,
  getJobs,
  getPairingStatus,
  getSettings,
  rotatePairingToken,
  updateSettings,
  verifyF95Account,
} from "@/services/systemService";

export interface SystemState {
  accounts: AccountStatus[];
  accountsLoading: boolean;
  accountsError: string | null;
  verifyingAccount: boolean;
  settings: AppSettings | null;
  settingsLoading: boolean;
  settingsSaving: boolean;
  settingsError: string | null;
  pairing: PairingStatus | null;
  pairingLoading: boolean;
  pairingError: string | null;
  jobs: IndexJob[];
  sseConnected: boolean;
  activeJob: IndexJob | null;
  currentItemName: string | null;
  lastJobError: string | null;
  statusNotice: string | null;
}

const initialState: SystemState = {
  accounts: [],
  accountsLoading: false,
  accountsError: null,
  verifyingAccount: false,
  settings: null,
  settingsLoading: false,
  settingsSaving: false,
  settingsError: null,
  pairing: null,
  pairingLoading: false,
  pairingError: null,
  jobs: [],
  sseConnected: false,
  activeJob: null,
  currentItemName: null,
  lastJobError: null,
  statusNotice: null,
};

export const fetchAccountsThunk = createAsyncThunk<
  AccountStatus[],
  void,
  { rejectValue: NormalizedApiError }
>("system/fetchAccounts", async (_, { rejectWithValue }) => {
  try {
    return await getAccounts();
  } catch (err) {
    return rejectWithValue(toNormalizedApiError(err));
  }
});

export const verifyF95AccountThunk = createAsyncThunk<
  { account: AccountStatus; error?: { flag: string; details?: string } },
  void,
  { rejectValue: NormalizedApiError }
>("system/verifyF95Account", async (_, { rejectWithValue }) => {
  try {
    return await verifyF95Account();
  } catch (err) {
    return rejectWithValue(toNormalizedApiError(err));
  }
});

export const clearF95AccountThunk = createAsyncThunk<
  AccountStatus,
  void,
  { rejectValue: NormalizedApiError }
>("system/clearF95Account", async (_, { rejectWithValue }) => {
  try {
    return await clearF95Account();
  } catch (err) {
    return rejectWithValue(toNormalizedApiError(err));
  }
});

export const fetchSettingsThunk = createAsyncThunk<
  AppSettings,
  void,
  { rejectValue: NormalizedApiError }
>("system/fetchSettings", async (_, { rejectWithValue }) => {
  try {
    return await getSettings();
  } catch (err) {
    return rejectWithValue(toNormalizedApiError(err));
  }
});

export const updateSettingsThunk = createAsyncThunk<
  AppSettings,
  UpdateAppSettings,
  { rejectValue: NormalizedApiError }
>("system/updateSettings", async (patch, { rejectWithValue }) => {
  try {
    return await updateSettings(patch);
  } catch (err) {
    return rejectWithValue(toNormalizedApiError(err));
  }
});

export const fetchPairingStatusThunk = createAsyncThunk<
  PairingStatus,
  void,
  { rejectValue: NormalizedApiError }
>("system/fetchPairingStatus", async (_, { rejectWithValue }) => {
  try {
    return await getPairingStatus();
  } catch (err) {
    return rejectWithValue(toNormalizedApiError(err));
  }
});

export const createPairingCodeThunk = createAsyncThunk<
  { code: string; expiresAtMs: number },
  void,
  { rejectValue: NormalizedApiError }
>("system/createPairingCode", async (_, { rejectWithValue }) => {
  try {
    return await createPairingCode();
  } catch (err) {
    return rejectWithValue(toNormalizedApiError(err));
  }
});

export const rotatePairingTokenThunk = createAsyncThunk<
  PairingStatus,
  void,
  { rejectValue: NormalizedApiError }
>("system/rotatePairingToken", async (_, { rejectWithValue }) => {
  try {
    return await rotatePairingToken();
  } catch (err) {
    return rejectWithValue(toNormalizedApiError(err));
  }
});

export const fetchJobsThunk = createAsyncThunk<
  IndexJob[],
  void,
  { rejectValue: NormalizedApiError }
>("system/fetchJobs", async (_, { rejectWithValue }) => {
  try {
    return await getJobs();
  } catch (err) {
    return rejectWithValue(toNormalizedApiError(err));
  }
});

export const cancelJobThunk = createAsyncThunk<
  { cancelling: boolean },
  string,
  { rejectValue: NormalizedApiError }
>("system/cancelJob", async (id, { rejectWithValue }) => {
  try {
    return await cancelJob(id);
  } catch (err) {
    return rejectWithValue(toNormalizedApiError(err));
  }
});

function upsertAccount(accounts: AccountStatus[], next: AccountStatus): AccountStatus[] {
  const idx = accounts.findIndex((a) => a.id === next.id);
  if (idx === -1) return [...accounts, next];
  const copy = [...accounts];
  copy[idx] = next;
  return copy;
}

const systemSlice = createSlice({
  name: "system",
  initialState,
  reducers: {
    sseConnectionChanged(state, action: PayloadAction<boolean>) {
      state.sseConnected = action.payload;
    },
    sseJobStarted(state, action: PayloadAction<IndexJob>) {
      state.activeJob = action.payload;
      state.lastJobError = null;
    },
    sseJobProgress(
      state,
      action: PayloadAction<{ job: IndexJob; currentGameName?: string }>
    ) {
      state.activeJob = action.payload.job;
      if (action.payload.currentGameName) {
        state.currentItemName = action.payload.currentGameName;
      }
    },
    sseJobCompleted(state, action: PayloadAction<IndexJob | undefined>) {
      state.activeJob = null;
      state.currentItemName = null;
      state.lastJobError = action.payload?.errorSummary ?? null;
    },
    sseJobFailed(state, action: PayloadAction<string>) {
      state.activeJob = null;
      state.currentItemName = null;
      state.lastJobError = action.payload;
    },
    sseAccountUpdated(state, action: PayloadAction<AccountStatus>) {
      state.accounts = upsertAccount(state.accounts, action.payload);
    },
    setStatusNotice(state, action: PayloadAction<string | null>) {
      state.statusNotice = action.payload;
    },
    clearStatusNotice(state) {
      state.statusNotice = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAccountsThunk.pending, (state) => {
        state.accountsLoading = true;
        state.accountsError = null;
      })
      .addCase(fetchAccountsThunk.fulfilled, (state, action) => {
        state.accountsLoading = false;
        state.accounts = action.payload;
      })
      .addCase(fetchAccountsThunk.rejected, (state, action) => {
        state.accountsLoading = false;
        state.accountsError =
          action.payload?.message ??
          action.error.message ??
          "Failed to load accounts.";
      })

      .addCase(verifyF95AccountThunk.pending, (state) => {
        state.verifyingAccount = true;
        state.accountsError = null;
      })
      .addCase(verifyF95AccountThunk.fulfilled, (state, action) => {
        state.verifyingAccount = false;
        state.accounts = upsertAccount(state.accounts, action.payload.account);
        state.statusNotice =
          action.payload.account.status === "active"
            ? "F95zone session verified active."
            : `Session status: ${action.payload.account.status}`;
      })
      .addCase(verifyF95AccountThunk.rejected, (state, action) => {
        state.verifyingAccount = false;
        const msg =
          action.payload?.message ??
          action.error.message ??
          "Verify session failed.";
        state.accountsError = msg;
        state.statusNotice = msg;
      })

      .addCase(clearF95AccountThunk.fulfilled, (state, action) => {
        state.accounts = upsertAccount(state.accounts, action.payload);
        state.statusNotice = "Stored F95zone cookies cleared.";
      })
      .addCase(clearF95AccountThunk.rejected, (state, action) => {
        state.accountsError =
          action.payload?.message ??
          action.error.message ??
          "Failed to clear session.";
      })

      .addCase(fetchSettingsThunk.pending, (state) => {
        state.settingsLoading = true;
        state.settingsError = null;
      })
      .addCase(fetchSettingsThunk.fulfilled, (state, action) => {
        state.settingsLoading = false;
        state.settings = action.payload;
      })
      .addCase(fetchSettingsThunk.rejected, (state, action) => {
        state.settingsLoading = false;
        state.settingsError =
          action.payload?.message ??
          action.error.message ??
          "Failed to load settings.";
      })

      .addCase(updateSettingsThunk.pending, (state) => {
        state.settingsSaving = true;
        state.settingsError = null;
      })
      .addCase(updateSettingsThunk.fulfilled, (state, action) => {
        state.settingsSaving = false;
        state.settings = action.payload;
      })
      .addCase(updateSettingsThunk.rejected, (state, action) => {
        state.settingsSaving = false;
        state.settingsError =
          action.payload?.message ??
          action.error.message ??
          "Failed to update settings.";
      })

      .addCase(fetchPairingStatusThunk.pending, (state) => {
        state.pairingLoading = true;
        state.pairingError = null;
      })
      .addCase(fetchPairingStatusThunk.fulfilled, (state, action) => {
        state.pairingLoading = false;
        state.pairing = action.payload;
      })
      .addCase(fetchPairingStatusThunk.rejected, (state, action) => {
        state.pairingLoading = false;
        state.pairingError =
          action.payload?.message ??
          action.error.message ??
          "Failed to fetch pairing status.";
      })

      .addCase(createPairingCodeThunk.pending, (state) => {
        state.pairingLoading = true;
        state.pairingError = null;
      })
      .addCase(createPairingCodeThunk.fulfilled, (state, action) => {
        state.pairingLoading = false;
        if (state.pairing) {
          state.pairing = {
            ...state.pairing,
            activeCode: action.payload,
          };
        }
      })
      .addCase(createPairingCodeThunk.rejected, (state, action) => {
        state.pairingLoading = false;
        state.pairingError =
          action.payload?.message ??
          action.error.message ??
          "Failed to generate pairing code.";
      })

      .addCase(rotatePairingTokenThunk.pending, (state) => {
        state.pairingLoading = true;
        state.pairingError = null;
      })
      .addCase(rotatePairingTokenThunk.fulfilled, (state, action) => {
        state.pairingLoading = false;
        state.pairing = action.payload;
        state.statusNotice = "Pairing token rotated. Re-pair your extension.";
      })
      .addCase(rotatePairingTokenThunk.rejected, (state, action) => {
        state.pairingLoading = false;
        state.pairingError =
          action.payload?.message ??
          action.error.message ??
          "Failed to rotate pairing token.";
      })

      .addCase(fetchJobsThunk.fulfilled, (state, action) => {
        state.jobs = action.payload;
      });
  },
});

export const {
  sseConnectionChanged,
  sseJobStarted,
  sseJobProgress,
  sseJobCompleted,
  sseJobFailed,
  sseAccountUpdated,
  setStatusNotice,
  clearStatusNotice,
} = systemSlice.actions;

export const systemReducer = systemSlice.reducer;
