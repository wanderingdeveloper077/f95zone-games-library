import type { GameDetail, GameSummary } from "@game-library/shared";
import { Status, Type } from "@game-library/shared";
import { AxiosError, AxiosHeaders } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiClientError, toNormalizedApiError } from "../../services/api";
import * as gamesService from "../../services/gamesService";
import { createAppStore } from "../store";
import {
  createGamesThunk,
  deleteGameThunk,
  fetchGamesThunk,
  fetchMoreGamesThunk,
  initialGamesFilter,
  launchGameThunk,
  setSelectedGameId,
  setViewMode,
  updateGameThunk,
} from "../slices/gamesSlice";

vi.mock("../../services/gamesService", async () => {
  const actual = await vi.importActual<typeof import("../../services/gamesService")>(
    "../../services/gamesService"
  );
  return {
    ...actual,
    getGames: vi.fn(),
    getGameDetail: vi.fn(),
    createGames: vi.fn(),
    updateGame: vi.fn(),
    deleteGame: vi.fn(),
    launchGame: vi.fn(),
  };
});

const SAMPLE_GAME: GameSummary = {
  id: 1001,
  custom: false,
  name: "Sample Game",
  version: "0.9",
  developer: "Dev",
  type: Type.RenPy,
  status: Status.Normal,
  url: "https://f95zone.to/threads/1001/",
  installedVersion: "",
  finishedVersion: "",
  hasUpdate: false,
  archived: false,
  rating: 0,
  notes: "",
  addedAtMs: 1_700_000_000_000,
  lastUpdatedTsSec: 1_700_000_000,
  lastCheckedAtMs: 1_700_000_000_000,
  coverFile: null,
  score: 4.5,
  votes: 120,
  tags: [],
  executables: [],
  lastError: null,
};

const SAMPLE_DETAIL: GameDetail = {
  ...SAMPLE_GAME,
  installedVersion: "0.9",
  notes: "Saved note",
  description: "Overview",
  changelog: "Changes",
  unknownTags: [],
  unknownTagsFlag: false,
  imageUrl: "",
  previewsUrls: [],
  galleryFiles: [],
  downloads: [],
  reviewsTotal: 0,
  reviews: [],
  executables: [],
  playtimeSec: 0,
  lastLaunchedAtMs: 0,
  updatedAtMs: 1_700_000_000_000,
};

describe("Axios error normalization & Redux Toolkit gamesSlice", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("normalizes backend Axios error envelopes and network failures", () => {
    const axiosErr = new AxiosError(
      "Request failed",
      "ERR_BAD_REQUEST",
      undefined,
      undefined,
      {
        status: 401,
        statusText: "Unauthorized",
        headers: new AxiosHeaders(),
        config: { headers: new AxiosHeaders() },
        data: {
          error: {
            code: "INVALID_PAIRING_TOKEN",
            message: "Missing or invalid X-Pairing-Token header.",
          },
        },
      }
    );

    expect(toNormalizedApiError(axiosErr)).toEqual({
      status: 401,
      code: "INVALID_PAIRING_TOKEN",
      message: "Missing or invalid X-Pairing-Token header.",
    });

    const netErr = new AxiosError("Network Error", "ERR_NETWORK");
    expect(toNormalizedApiError(netErr)).toMatchObject({
      status: null,
      code: "NETWORK_ERROR",
      message: "Network Error",
    });
  });

  it("handles fetchGamesThunk pending, fulfilled, and rejected states", async () => {
    const store = createAppStore();

    vi.mocked(gamesService.getGames).mockResolvedValueOnce({
      games: [SAMPLE_GAME],
      total: 1,
      updatesCount: 0,
      hasMore: false,
      nextOffset: null,
    });
    const pendingPromise = store.dispatch(fetchGamesThunk(initialGamesFilter));
    expect(store.getState().games.loading).toBe(true);
    await pendingPromise;
    expect(store.getState().games.loading).toBe(false);
    expect(store.getState().games.items).toEqual([SAMPLE_GAME]);
    expect(store.getState().games.totalCount).toBe(1);
    expect(store.getState().games.hasMore).toBe(false);
    expect(store.getState().games.error).toBeNull();

    vi.mocked(gamesService.getGames).mockRejectedValueOnce(
      new ApiClientError({
        status: 500,
        code: "INTERNAL_ERROR",
        message: "Database locked",
      })
    );
    await store.dispatch(fetchGamesThunk(initialGamesFilter));
    expect(store.getState().games.loading).toBe(false);
    expect(store.getState().games.error).toBe("Database locked");
  });

  it("handles create, update, and delete thunks cleanly across list and selected detail", async () => {
    const store = createAppStore();

    vi.mocked(gamesService.createGames).mockResolvedValueOnce({
      added: [SAMPLE_GAME],
      jobId: "job-1",
    });
    await store.dispatch(
      createGamesThunk({
        urls: ["https://f95zone.to/threads/1001/"],
        autoRefresh: true,
      })
    );
    expect(store.getState().games.items).toHaveLength(1);

    store.dispatch(setSelectedGameId(1001));
    vi.mocked(gamesService.updateGame).mockResolvedValueOnce(SAMPLE_DETAIL);
    await store.dispatch(
      updateGameThunk({
        id: 1001,
        patch: { installedVersion: "0.9", notes: "Saved note" },
      })
    );
    expect(store.getState().games.items[0]?.installedVersion).toBe("0.9");
    expect(store.getState().games.items[0]?.notes).toBe("Saved note");

    vi.mocked(gamesService.deleteGame).mockResolvedValueOnce({
      deleted: true,
      id: 1001,
    });
    await store.dispatch(deleteGameThunk(1001));
    expect(store.getState().games.items).toHaveLength(0);
    expect(store.getState().games.selectedGameId).toBeNull();
  });

  it("updates executables and tracks launchGameThunk state transitions", async () => {
    const store = createAppStore();
    vi.mocked(gamesService.getGames).mockResolvedValueOnce({
      games: [SAMPLE_GAME],
      total: 1,
      updatesCount: 0,
      hasMore: false,
      nextOffset: null,
    });
    await store.dispatch(fetchGamesThunk(initialGamesFilter));
    store.dispatch(setSelectedGameId(1001));

    const withExeDetail: GameDetail = {
      ...SAMPLE_DETAIL,
      executables: ["C:\\Games\\Sample\\Sample.exe"],
    };
    vi.mocked(gamesService.updateGame).mockResolvedValueOnce(withExeDetail);
    await store.dispatch(
      updateGameThunk({
        id: 1001,
        patch: { executables: ["C:\\Games\\Sample\\Sample.exe"] },
      })
    );
    expect(store.getState().games.items[0]?.executables).toEqual([
      "C:\\Games\\Sample\\Sample.exe",
    ]);
    expect(store.getState().games.selectedGame?.executables).toEqual([
      "C:\\Games\\Sample\\Sample.exe",
    ]);

    vi.mocked(gamesService.launchGame).mockResolvedValueOnce({
      launched: true,
      executable: "C:\\Games\\Sample\\Sample.exe",
      lastLaunchedAtMs: 1_700_000_005_000,
    });
    const pendingLaunch = store.dispatch(
      launchGameThunk({ id: 1001, executable: "C:\\Games\\Sample\\Sample.exe" })
    );
    expect(store.getState().games.launchingGameId).toBe(1001);
    await pendingLaunch;
    expect(store.getState().games.launchingGameId).toBeNull();
    expect(store.getState().games.selectedGame?.lastLaunchedAtMs).toBe(
      1_700_000_005_000
    );

    vi.mocked(gamesService.launchGame).mockRejectedValueOnce(
      new ApiClientError({
        status: 404,
        code: "EXECUTABLE_NOT_FOUND",
        message: "Executable missing",
      })
    );
    await store.dispatch(launchGameThunk({ id: 1001 }));
    expect(store.getState().games.launchingGameId).toBeNull();
    expect(store.getState().games.launchError).toBe("Executable missing");
  });

  it("supports switching viewMode between grid, small-grid, and list", () => {
    const store = createAppStore();
    expect(store.getState().games.viewMode).toBe("grid");

    store.dispatch(setViewMode("small-grid"));
    expect(store.getState().games.viewMode).toBe("small-grid");

    store.dispatch(setViewMode("list"));
    expect(store.getState().games.viewMode).toBe("list");
  });

  it("loads next pages with fetchMoreGamesThunk and deduplicates items", async () => {
    const store = createAppStore();
    const secondGame: GameSummary = {
      ...SAMPLE_GAME,
      id: 1002,
      name: "Second Game",
      hasUpdate: true,
    };

    vi.mocked(gamesService.getGames).mockResolvedValueOnce({
      games: [SAMPLE_GAME],
      total: 2,
      updatesCount: 1,
      hasMore: true,
      nextOffset: 1,
    });
    await store.dispatch(fetchGamesThunk(initialGamesFilter));
    expect(store.getState().games.hasMore).toBe(true);
    expect(store.getState().games.nextOffset).toBe(1);

    vi.mocked(gamesService.getGames).mockResolvedValueOnce({
      games: [SAMPLE_GAME, secondGame],
      total: 2,
      updatesCount: 1,
      hasMore: false,
      nextOffset: null,
    });
    await store.dispatch(fetchMoreGamesThunk());
    expect(store.getState().games.items.map((g) => g.id)).toEqual([1001, 1002]);
    expect(store.getState().games.hasMore).toBe(false);
    expect(store.getState().games.nextOffset).toBeNull();
    expect(store.getState().games.totalCount).toBe(2);
    expect(store.getState().games.updatesCount).toBe(1);
  });
});
