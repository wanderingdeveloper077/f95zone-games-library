import type {
  CreateGamesInput,
  GameDetail,
  GameSummary,
  IndexJob,
  UpdateGameInput,
} from "@game-library/shared";
import { type PayloadAction, createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { type NormalizedApiError, toNormalizedApiError } from "../../services/api";
import {
  type CreateGamesResult,
  type GamesFilterState,
  createGames,
  deleteGame,
  getGameDetail,
  getGames,
  importF95List,
  launchGame,
  openGameFolder,
  refreshGames,
  updateGame,
} from "../../services/gamesService";

export interface GamesState {
  items: GameSummary[];
  loading: boolean;
  error: string | null;
  mutating: boolean;
  creating: boolean;
  createError: string | null;
  refreshing: boolean;
  launchingGameId: number | null;
  launchError: string | null;
  filter: GamesFilterState;
  viewMode: "grid" | "list";
  selectedGameId: number | null;
  selectedGame: GameDetail | null;
  detailLoading: boolean;
  detailError: string | null;
}

export const initialGamesFilter: GamesFilterState = {
  search: "",
  status: "",
  type: "",
  updatesOnly: false,
  showArchived: false,
  sort: "lastUpdated",
  dir: "desc",
};

const initialState: GamesState = {
  items: [],
  loading: false,
  error: null,
  mutating: false,
  creating: false,
  createError: null,
  refreshing: false,
  launchingGameId: null,
  launchError: null,
  filter: initialGamesFilter,
  viewMode: "grid",
  selectedGameId: null,
  selectedGame: null,
  detailLoading: false,
  detailError: null,
};

function toSummary(detail: GameDetail): GameSummary {
  return {
    id: detail.id,
    custom: detail.custom,
    name: detail.name,
    version: detail.version,
    developer: detail.developer,
    type: detail.type,
    status: detail.status,
    url: detail.url,
    installedVersion: detail.installedVersion,
    finishedVersion: detail.finishedVersion,
    hasUpdate: detail.hasUpdate,
    archived: detail.archived,
    rating: detail.rating,
    notes: detail.notes,
    addedAtMs: detail.addedAtMs,
    lastUpdatedTsSec: detail.lastUpdatedTsSec,
    lastCheckedAtMs: detail.lastCheckedAtMs,
    coverFile: detail.coverFile,
    score: detail.score,
    votes: detail.votes,
    tags: detail.tags,
    executables: detail.executables,
    lastError: detail.lastError,
  };
}

export const fetchGamesThunk = createAsyncThunk<
  GameSummary[],
  GamesFilterState,
  { rejectValue: NormalizedApiError }
>("games/fetchGames", async (filter, { rejectWithValue }) => {
  try {
    return await getGames(filter);
  } catch (err) {
    return rejectWithValue(toNormalizedApiError(err));
  }
});

export const fetchGameDetailThunk = createAsyncThunk<
  GameDetail,
  number,
  { rejectValue: NormalizedApiError }
>("games/fetchDetail", async (id, { rejectWithValue }) => {
  try {
    return await getGameDetail(id);
  } catch (err) {
    return rejectWithValue(toNormalizedApiError(err));
  }
});

export const createGamesThunk = createAsyncThunk<
  CreateGamesResult,
  CreateGamesInput,
  { rejectValue: NormalizedApiError }
>("games/createGames", async (input, { rejectWithValue }) => {
  try {
    return await createGames(input);
  } catch (err) {
    return rejectWithValue(toNormalizedApiError(err));
  }
});

export const updateGameThunk = createAsyncThunk<
  GameDetail,
  { id: number; patch: UpdateGameInput },
  { rejectValue: NormalizedApiError }
>("games/updateGame", async ({ id, patch }, { rejectWithValue }) => {
  try {
    return await updateGame(id, patch);
  } catch (err) {
    return rejectWithValue(toNormalizedApiError(err));
  }
});

export const deleteGameThunk = createAsyncThunk<
  { deleted: boolean; id: number },
  number,
  { rejectValue: NormalizedApiError }
>("games/deleteGame", async (id, { rejectWithValue }) => {
  try {
    return await deleteGame(id);
  } catch (err) {
    return rejectWithValue(toNormalizedApiError(err));
  }
});

export const refreshGamesThunk = createAsyncThunk<
  IndexJob,
  { gameIds?: number[]; force?: boolean } | undefined,
  { rejectValue: NormalizedApiError }
>("games/refreshGames", async (args, { rejectWithValue }) => {
  try {
    return await refreshGames(args?.gameIds, args?.force ?? false);
  } catch (err) {
    return rejectWithValue(toNormalizedApiError(err));
  }
});

export const importF95ListThunk = createAsyncThunk<
  IndexJob,
  "watched" | "bookmarks",
  { rejectValue: NormalizedApiError }
>("games/importF95List", async (source, { rejectWithValue }) => {
  try {
    return await importF95List(source);
  } catch (err) {
    return rejectWithValue(toNormalizedApiError(err));
  }
});

export const launchGameThunk = createAsyncThunk<
  { id: number; executable: string; lastLaunchedAtMs: number },
  { id: number; executable?: string },
  { rejectValue: NormalizedApiError }
>("games/launchGame", async ({ id, executable }, { rejectWithValue }) => {
  try {
    const res = await launchGame(id, executable);
    return { id, ...res };
  } catch (err) {
    return rejectWithValue(toNormalizedApiError(err));
  }
});

export const openGameFolderThunk = createAsyncThunk<
  { opened: boolean; folder: string },
  { id: number; executable?: string },
  { rejectValue: NormalizedApiError }
>("games/openFolder", async ({ id, executable }, { rejectWithValue }) => {
  try {
    return await openGameFolder(id, executable);
  } catch (err) {
    return rejectWithValue(toNormalizedApiError(err));
  }
});

const gamesSlice = createSlice({
  name: "games",
  initialState,
  reducers: {
    setFilter(state, action: PayloadAction<GamesFilterState>) {
      state.filter = action.payload;
    },
    setViewMode(state, action: PayloadAction<"grid" | "list">) {
      state.viewMode = action.payload;
    },
    setSelectedGameId(state, action: PayloadAction<number | null>) {
      state.selectedGameId = action.payload;
      state.launchError = null;
      if (action.payload === null) {
        state.selectedGame = null;
        state.detailError = null;
      }
    },
    clearGamesError(state) {
      state.error = null;
    },
    clearCreateError(state) {
      state.createError = null;
    },
    clearLaunchError(state) {
      state.launchError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchGamesThunk.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchGamesThunk.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload;
      })
      .addCase(fetchGamesThunk.rejected, (state, action) => {
        state.loading = false;
        state.error =
          action.payload?.message ??
          action.error.message ??
          "Failed to load games.";
      })

      .addCase(fetchGameDetailThunk.pending, (state) => {
        state.detailLoading = true;
        state.detailError = null;
      })
      .addCase(fetchGameDetailThunk.fulfilled, (state, action) => {
        state.detailLoading = false;
        if (state.selectedGameId === action.payload.id) {
          state.selectedGame = action.payload;
        }
      })
      .addCase(fetchGameDetailThunk.rejected, (state, action) => {
        state.detailLoading = false;
        state.detailError =
          action.payload?.message ??
          action.error.message ??
          "Failed to load game details.";
      })

      .addCase(createGamesThunk.pending, (state) => {
        state.creating = true;
        state.createError = null;
      })
      .addCase(createGamesThunk.fulfilled, (state, action) => {
        state.creating = false;
        const existingIds = new Set(state.items.map((g) => g.id));
        const fresh = action.payload.added.filter((g) => !existingIds.has(g.id));
        if (fresh.length > 0) {
          state.items = [...fresh, ...state.items];
        }
      })
      .addCase(createGamesThunk.rejected, (state, action) => {
        state.creating = false;
        state.createError =
          action.payload?.message ??
          action.error.message ??
          "Failed to add game.";
      })

      .addCase(updateGameThunk.pending, (state) => {
        state.mutating = true;
        state.error = null;
      })
      .addCase(updateGameThunk.fulfilled, (state, action) => {
        state.mutating = false;
        const updated = action.payload;
        if (
          state.selectedGameId === updated.id ||
          state.selectedGame?.id === updated.id
        ) {
          state.selectedGame = updated;
        }
        const summary = toSummary(updated);
        const idx = state.items.findIndex((g) => g.id === updated.id);
        if (idx !== -1) {
          if (!state.filter.showArchived && updated.archived) {
            state.items.splice(idx, 1);
          } else {
            state.items[idx] = summary;
          }
        }
      })
      .addCase(updateGameThunk.rejected, (state, action) => {
        state.mutating = false;
        state.error =
          action.payload?.message ??
          action.error.message ??
          "Failed to update game.";
      })

      .addCase(deleteGameThunk.pending, (state) => {
        state.mutating = true;
        state.error = null;
      })
      .addCase(deleteGameThunk.fulfilled, (state, action) => {
        state.mutating = false;
        state.items = state.items.filter((g) => g.id !== action.payload.id);
        if (state.selectedGameId === action.payload.id) {
          state.selectedGameId = null;
          state.selectedGame = null;
        }
      })
      .addCase(deleteGameThunk.rejected, (state, action) => {
        state.mutating = false;
        state.error =
          action.payload?.message ??
          action.error.message ??
          "Failed to remove game.";
      })

      .addCase(refreshGamesThunk.pending, (state) => {
        state.refreshing = true;
        state.error = null;
      })
      .addCase(refreshGamesThunk.fulfilled, (state) => {
        state.refreshing = false;
      })
      .addCase(refreshGamesThunk.rejected, (state, action) => {
        state.refreshing = false;
        state.error =
          action.payload?.message ??
          action.error.message ??
          "Failed to trigger refresh.";
      })

      .addCase(importF95ListThunk.pending, (state) => {
        state.refreshing = true;
      })
      .addCase(importF95ListThunk.fulfilled, (state) => {
        state.refreshing = false;
      })
      .addCase(importF95ListThunk.rejected, (state, action) => {
        state.refreshing = false;
        state.error =
          action.payload?.message ??
          action.error.message ??
          "Failed to start import.";
      })

      .addCase(launchGameThunk.pending, (state, action) => {
        state.launchingGameId = action.meta.arg.id;
        state.launchError = null;
        state.error = null;
      })
      .addCase(launchGameThunk.fulfilled, (state, action) => {
        state.launchingGameId = null;
        if (state.selectedGame?.id === action.payload.id) {
          state.selectedGame.lastLaunchedAtMs = action.payload.lastLaunchedAtMs;
        }
      })
      .addCase(launchGameThunk.rejected, (state, action) => {
        state.launchingGameId = null;
        const msg =
          action.payload?.message ??
          action.error.message ??
          "Failed to launch game.";
        state.launchError = msg;
        state.error = msg;
      })

      .addCase(openGameFolderThunk.pending, (state) => {
        state.launchError = null;
        state.error = null;
      })
      .addCase(openGameFolderThunk.rejected, (state, action) => {
        const msg =
          action.payload?.message ??
          action.error.message ??
          "Failed to open game folder.";
        state.launchError = msg;
        state.error = msg;
      });
  },
});

export const {
  setFilter,
  setViewMode,
  setSelectedGameId,
  clearGamesError,
  clearCreateError,
  clearLaunchError,
} = gamesSlice.actions;

export const gamesReducer = gamesSlice.reducer;
