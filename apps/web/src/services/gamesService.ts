import type {
  CreateGamesInput,
  GameDetail,
  GameSummary,
  IndexJob,
  LaunchGameResponse,
  OpenFolderResponse,
  UpdateGameInput,
} from "@game-library/shared";
import { apiClient } from "./api";

export type InstalledFilterValue =
  | "all"
  | "installed"
  | "up_to_date"
  | "outdated"
  | "not_installed";
export type FinishedFilterValue = "all" | "finished" | "unfinished";

export interface GamesFilterState {
  search: string;
  status: string;
  type: string;
  tags: number[];
  installed: InstalledFilterValue;
  finished: FinishedFilterValue;
  updatesOnly: boolean;
  showArchived: boolean;
  sort: "lastUpdated" | "addedAt" | "name" | "score" | "rating";
  dir: "asc" | "desc";
}

export const DEFAULT_GAMES_PAGE_SIZE = 30;

export interface PaginatedGamesResponse {
  games: GameSummary[];
  total: number;
  updatesCount: number;
  hasMore: boolean;
  nextOffset: number | null;
}

export interface CreateGamesResult {
  added: GameSummary[];
  duplicateIds?: number[];
  jobId: string | null;
}

function withExecutables<T extends { executables?: string[] }>(game: T): T {
  return {
    ...game,
    executables: Array.isArray(game.executables) ? game.executables : [],
  };
}

export async function getGames(
  filter: GamesFilterState,
  pagination?: { limit?: number; offset?: number }
): Promise<PaginatedGamesResponse> {
  const params: Record<string, string | number> = {
    sort: filter.sort,
    dir: filter.dir,
  };
  if (filter.search.trim()) params.search = filter.search.trim();
  if (filter.status) params.status = filter.status;
  if (filter.type) params.type = filter.type;
  if (filter.tags.length > 0) params.tags = filter.tags.join(",");
  if (filter.installed !== "all") params.installed = filter.installed;
  if (filter.finished !== "all") params.finished = filter.finished;
  if (filter.updatesOnly) params.updatesOnly = "true";
  if (!filter.showArchived) params.archived = "false";
  if (pagination?.limit !== undefined) params.limit = pagination.limit;
  if (pagination?.offset !== undefined) params.offset = pagination.offset;

  const { data } = await apiClient.get<{
    games: GameSummary[];
    total?: number;
    updatesCount?: number;
    hasMore?: boolean;
    nextOffset?: number | null;
  }>("/api/games", {
    params,
  });
  const games = data.games.map(withExecutables);
  return {
    games,
    total: data.total ?? games.length,
    updatesCount:
      data.updatesCount ?? games.reduce((acc, g) => acc + (g.hasUpdate ? 1 : 0), 0),
    hasMore: data.hasMore ?? false,
    nextOffset: data.nextOffset ?? null,
  };
}

export async function getGameDetail(id: number): Promise<GameDetail> {
  const { data } = await apiClient.get<{ game: GameDetail }>(
    `/api/games/${id}`
  );
  return withExecutables(data.game);
}

export async function createGames(
  input: CreateGamesInput
): Promise<CreateGamesResult> {
  const { data } = await apiClient.post<CreateGamesResult>("/api/games", input);
  return {
    ...data,
    added: data.added.map(withExecutables),
  };
}

export async function updateGame(
  id: number,
  patch: UpdateGameInput
): Promise<GameDetail> {
  const { data } = await apiClient.patch<{ game: GameDetail }>(
    `/api/games/${id}`,
    patch
  );
  return withExecutables(data.game);
}

export async function deleteGame(
  id: number
): Promise<{ deleted: boolean; id: number }> {
  const { data } = await apiClient.delete<{ deleted: boolean; id: number }>(
    `/api/games/${id}`
  );
  return data;
}

export async function refreshGames(
  gameIds?: number[],
  force = false
): Promise<IndexJob> {
  const { data } = await apiClient.post<{ job: IndexJob }>(
    "/api/games/refresh",
    { gameIds, force }
  );
  return data.job;
}

export async function importF95List(
  source: "watched" | "bookmarks"
): Promise<IndexJob> {
  const { data } = await apiClient.post<{ job: IndexJob }>(
    `/api/games/import/${source}`
  );
  return data.job;
}

export async function launchGame(
  id: number,
  executable?: string
): Promise<LaunchGameResponse> {
  const { data } = await apiClient.post<LaunchGameResponse>(
    `/api/games/${id}/launch`,
    executable !== undefined ? { executable } : {}
  );
  return data;
}

export async function openGameFolder(
  id: number,
  executable?: string
): Promise<OpenFolderResponse> {
  const { data } = await apiClient.post<OpenFolderResponse>(
    `/api/games/${id}/open-folder`,
    executable !== undefined ? { executable } : {}
  );
  return data;
}

export interface GamesService {
  getGames: typeof getGames;
  getGameDetail: typeof getGameDetail;
  createGames: typeof createGames;
  updateGame: typeof updateGame;
  deleteGame: typeof deleteGame;
  refreshGames: typeof refreshGames;
  importF95List: typeof importF95List;
  launchGame: typeof launchGame;
  openGameFolder: typeof openGameFolder;
}

export const gamesService: GamesService = {
  getGames,
  getGameDetail,
  createGames,
  updateGame,
  deleteGame,
  refreshGames,
  importF95List,
  launchGame,
  openGameFolder,
};
