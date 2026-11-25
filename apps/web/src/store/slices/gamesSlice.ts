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
  DEFAULT_GAMES_PAGE_SIZE,
  type GamesFilterState,
  type PaginatedGamesResponse,
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

export type LibraryViewMode = "grid" | "small-grid" | "list";

const VIEW_MODE_STORAGE_KEY = "glm_view_mode";

export function loadInitialViewMode(): LibraryViewMode {
  try {
    if (typeof localStorage === "undefined") return "grid";
    const stored = localStorage.getItem(VIEW_MODE_STORAGE_KEY);
    if (stored === "grid" || stored === "small-grid" || stored === "list") {
      return stored;
    }
  } catch {
    // Ignore storage read restrictions in sandboxed environments.
  }
  return "grid";
}

function persistViewMode(mode: LibraryViewMode): void {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(VIEW_MODE_STORAGE_KEY, mode);
    }
  } catch {
    // Ignore storage write errors.
  }
}

export interface GamesState {
  items: GameSummary[];
  totalCount: number;
  updatesCount: number;
  hasMore: boolean;
  nextOffset: number | null;
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  mutating: boolean;
  creating: boolean;
  createError: string | null;
  refreshing: boolean;
  launchingGameId: number | null;
  launchError: string | null;
  filter: GamesFilterState;
  viewMode: LibraryViewMode;
  selectedGameId: number | null;
  selectedGame: GameDetail | null;
  detailLoading: boolean;
  detailError: string | null;
}

export const initialGamesFilter: GamesFilterState = {
  search: "",
  status: "",
  type: "",
  tags: [],
  installed: "all",
  finished: "all",
  updatesOnly: false,
  showArchived: false,
  sort: "lastUpdated",
  dir: "desc",
};

const initialState: GamesState = {
  items: [],
  totalCount: 0,
  updatesCount: 0,
  hasMore: false,
  nextOffset: null,
  loading: false,
  loadingMore: false,
  error: null,
  mutating: false,
  creating: false,
  createError: null,
  refreshing: false,
  launchingGameId: null,
  launchError: null,
  filter: initialGamesFilter,
  viewMode: loadInitialViewMode(),
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

export type FetchGamesArg =
  | GamesFilterState
  | { filter: GamesFilterState; preserveLoadedCount?: boolean };

export const fetchGamesThunk = createAsyncThunk<
  PaginatedGamesResponse,
  FetchGamesArg,
  { state: { games: GamesState }; rejectValue: NormalizedApiError }
>("games/fetchGames", async (arg, { getState, rejectWithValue }) => {
  try {
    const filter = "filter" in arg ? arg.filter : arg;
    const preserveLoadedCount =
      "filter" in arg ? Boolean(arg.preserveLoadedCount) : false;
    const limit = preserveLoadedCount
      ? Math.max(DEFAULT_GAMES_PAGE_SIZE, getState().games.items.length)
      : DEFAULT_GAMES_PAGE_SIZE;
    return await getGames(filter, { limit, offset: 0 });
  } catch (err) {
    return rejectWithValue(toNormalizedApiError(err));
  }
});

export const fetchMoreGamesThunk = createAsyncThunk<
  PaginatedGamesResponse,
  void,
  { state: { games: GamesState }; rejectValue: NormalizedApiError }
>(
  "games/fetchMoreGames",
  async (_arg, { getState, rejectWithValue }) => {
    const { filter, nextOffset } = getState().games;
    try {
      return await getGames(filter, {
        limit: DEFAULT_GAMES_PAGE_SIZE,
        offset: nextOffset ?? 0,
      });
    } catch (err) {
      return rejectWithValue(toNormalizedApiError(err));
    }
  },
  {
    condition: (_arg, { getState }) => {
      const { hasMore, nextOffset, loading, loadingMore } = getState().games;
      return hasMore && nextOffset !== null && !loading && !loadingMore;
    },
  }
);

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
    setViewMode(state, action: PayloadAction<LibraryViewMode>) {
      state.viewMode = action.payload;
      persistViewMode(action.payload);
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
        state.loadingMore = false;
        state.items = action.payload.games;
        state.totalCount = action.payload.total;
        state.updatesCount = action.payload.updatesCount;
        state.hasMore = action.payload.hasMore;
        state.nextOffset = action.payload.nextOffset;
      })
      .addCase(fetchGamesThunk.rejected, (state, action) => {
        state.loading = false;
        state.error =
          action.payload?.message ??
          action.error.message ??
          "Failed to load games.";
      })

      .addCase(fetchMoreGamesThunk.pending, (state) => {
        state.loadingMore = true;
        state.error = null;
      })
      .addCase(fetchMoreGamesThunk.fulfilled, (state, action) => {
        state.loadingMore = false;
        const existingIds = new Set(state.items.map((g) => g.id));
        const fresh = action.payload.games.filter((g) => !existingIds.has(g.id));
        if (fresh.length > 0) {
          state.items.push(...fresh);
        }
        state.totalCount = action.payload.total;
        state.updatesCount = action.payload.updatesCount;
        state.hasMore = action.payload.hasMore;
        state.nextOffset = action.payload.nextOffset;
      })
      .addCase(fetchMoreGamesThunk.rejected, (state, action) => {
        state.loadingMore = false;
        state.error =
          action.payload?.message ??
          action.error.message ??
          "Failed to load more games.";
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
          state.totalCount += fresh.length;
          state.updatesCount += fresh.filter((g) => g.hasUpdate).length;
          if (state.nextOffset !== null) {
            state.nextOffset += fresh.length;
          }
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
          const prevHasUpdate = state.items[idx]?.hasUpdate ?? false;
          if (!state.filter.showArchived && updated.archived) {
            state.items.splice(idx, 1);
            state.totalCount = Math.max(0, state.totalCount - 1);
            if (prevHasUpdate) {
              state.updatesCount = Math.max(0, state.updatesCount - 1);
            }
            if (state.nextOffset !== null && state.nextOffset > 0) {
              state.nextOffset -= 1;
            }
          } else {
            state.items[idx] = summary;
            if (prevHasUpdate !== summary.hasUpdate) {
              state.updatesCount = Math.max(
                0,
                state.updatesCount + (summary.hasUpdate ? 1 : -1)
              );
            }
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
        const removed = state.items.find((g) => g.id === action.payload.id);
        state.items = state.items.filter((g) => g.id !== action.payload.id);
        state.totalCount = Math.max(0, state.totalCount - 1);
        if (removed?.hasUpdate) {
          state.updatesCount = Math.max(0, state.updatesCount - 1);
        }
        if (removed && state.nextOffset !== null && state.nextOffset > 0) {
          state.nextOffset -= 1;
        }
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
