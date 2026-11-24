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

export interface GamesFilterState {
  search: string;
  status: string;
  type: string;
  updatesOnly: boolean;
  showArchived: boolean;
  sort: "lastUpdated" | "addedAt" | "name" | "score" | "rating";
  dir: "asc" | "desc";
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
  filter: GamesFilterState
): Promise<GameSummary[]> {
  const params: Record<string, string> = {
    sort: filter.sort,
    dir: filter.dir,
  };
  if (filter.search.trim()) params.search = filter.search.trim();
  if (filter.status) params.status = filter.status;
  if (filter.type) params.type = filter.type;
  if (filter.updatesOnly) params.updatesOnly = "true";
  if (!filter.showArchived) params.archived = "false";

  const { data } = await apiClient.get<{ games: GameSummary[] }>("/api/games", {
    params,
  });
  return data.games.map(withExecutables);
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
