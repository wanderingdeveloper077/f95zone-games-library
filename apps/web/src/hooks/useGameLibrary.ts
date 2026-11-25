import type { GameSummary } from "@game-library/shared";
import { useCallback, useEffect, useState } from "react";
import {
  getNextFinishedVersion,
  getNextInstalledVersion,
} from "@/lib/gamePresentation";
import type { GamesFilterState } from "@/services/gamesService";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  type LibraryViewMode,
  clearGamesError,
  fetchGamesThunk,
  fetchMoreGamesThunk,
  launchGameThunk,
  refreshGamesThunk,
  setFilter,
  setSelectedGameId,
  setViewMode,
  updateGameThunk,
} from "@/store/slices/gamesSlice";

export function useGameLibrary() {
  const dispatch = useAppDispatch();
  const games = useAppSelector((s) => s.games.items);
  const totalCount = useAppSelector((s) => s.games.totalCount);
  const updatesCount = useAppSelector((s) => s.games.updatesCount);
  const hasMore = useAppSelector((s) => s.games.hasMore);
  const loading = useAppSelector((s) => s.games.loading);
  const loadingMore = useAppSelector((s) => s.games.loadingMore);
  const error = useAppSelector((s) => s.games.error);
  const filter = useAppSelector((s) => s.games.filter);
  const viewMode = useAppSelector((s) => s.games.viewMode);
  const refreshing = useAppSelector((s) => s.games.refreshing);
  const launchingGameId = useAppSelector((s) => s.games.launchingGameId);
  const [chooseExeGame, setChooseExeGame] = useState<GameSummary | null>(null);

  useEffect(() => {
    void dispatch(fetchGamesThunk(filter));
  }, [dispatch, filter]);

  const updateFilter = useCallback(
    (next: GamesFilterState) => {
      dispatch(setFilter(next));
    },
    [dispatch]
  );

  const changeViewMode = useCallback(
    (mode: LibraryViewMode) => {
      dispatch(setViewMode(mode));
    },
    [dispatch]
  );

  const selectGame = useCallback(
    (id: number | null) => {
      dispatch(setSelectedGameId(id));
    },
    [dispatch]
  );

  const toggleInstalled = useCallback(
    (game: GameSummary) => {
      void dispatch(
        updateGameThunk({
          id: game.id,
          patch: { installedVersion: getNextInstalledVersion(game) },
        })
      );
    },
    [dispatch]
  );

  const toggleFinished = useCallback(
    (game: GameSummary) => {
      void dispatch(
        updateGameThunk({
          id: game.id,
          patch: { finishedVersion: getNextFinishedVersion(game) },
        })
      );
    },
    [dispatch]
  );

  const refreshAll = useCallback(() => {
    void dispatch(refreshGamesThunk({ force: false }));
  }, [dispatch]);

  const dismissError = useCallback(() => {
    dispatch(clearGamesError());
  }, [dispatch]);

  const playGame = useCallback(
    (game: GameSummary, executable?: string) => {
      if (executable !== undefined) {
        void dispatch(launchGameThunk({ id: game.id, executable }));
        return;
      }
      const executables = game.executables ?? [];
      if (executables.length === 0) {
        dispatch(setSelectedGameId(game.id));
        return;
      }
      if (executables.length === 1) {
        void dispatch(
          launchGameThunk({ id: game.id, executable: executables[0] })
        );
        return;
      }
      setChooseExeGame({ ...game, executables });
    },
    [dispatch]
  );

  const closeChooseExe = useCallback(() => {
    setChooseExeGame(null);
  }, []);

  const loadMore = useCallback(() => {
    void dispatch(fetchMoreGamesThunk());
  }, [dispatch]);

  return {
    games,
    totalCount,
    updatesCount,
    hasMore,
    loading,
    loadingMore,
    error,
    filter,
    viewMode,
    refreshing,
    launchingGameId,
    chooseExeGame,
    updateFilter,
    changeViewMode,
    selectGame,
    toggleInstalled,
    toggleFinished,
    playGame,
    closeChooseExe,
    loadMore,
    refreshAll,
    dismissError,
  };
}
