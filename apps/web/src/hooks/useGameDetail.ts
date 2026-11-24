import { useCallback, useEffect } from "react";
import { pickLocalPath } from "@/services/systemService";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  clearLaunchError,
  deleteGameThunk,
  fetchGameDetailThunk,
  launchGameThunk,
  openGameFolderThunk,
  refreshGamesThunk,
  updateGameThunk,
} from "@/store/slices/gamesSlice";

export function useGameDetail() {
  const dispatch = useAppDispatch();
  const selectedGameId = useAppSelector((s) => s.games.selectedGameId);
  const game = useAppSelector((s) => s.games.selectedGame);
  const loading = useAppSelector((s) => s.games.detailLoading);
  const error = useAppSelector((s) => s.games.detailError);
  const mutating = useAppSelector((s) => s.games.mutating);
  const refreshing = useAppSelector((s) => s.games.refreshing);
  const launching = useAppSelector(
    (s) =>
      s.games.selectedGameId !== null &&
      s.games.launchingGameId === s.games.selectedGameId
  );
  const launchError = useAppSelector((s) => s.games.launchError);
  const tagHighlights = useAppSelector(
    (s) => s.system.settings?.tagHighlights
  );

  useEffect(() => {
    if (selectedGameId !== null) {
      void dispatch(fetchGameDetailThunk(selectedGameId));
    }
  }, [selectedGameId, dispatch]);

  const reIndex = useCallback(() => {
    if (selectedGameId === null) return;
    void dispatch(refreshGamesThunk({ gameIds: [selectedGameId], force: true }));
  }, [dispatch, selectedGameId]);

  const updateRating = useCallback(
    (rating: number) => {
      if (selectedGameId === null) return;
      void dispatch(
        updateGameThunk({
          id: selectedGameId,
          patch: { rating },
        })
      );
    },
    [dispatch, selectedGameId]
  );

  const saveNotes = useCallback(
    async (notes: string): Promise<boolean> => {
      if (selectedGameId === null) return false;
      try {
        await dispatch(
          updateGameThunk({ id: selectedGameId, patch: { notes } })
        ).unwrap();
        return true;
      } catch {
        return false;
      }
    },
    [dispatch, selectedGameId]
  );

  const toggleArchive = useCallback(() => {
    if (selectedGameId === null || !game) return;
    void dispatch(
      updateGameThunk({
        id: selectedGameId,
        patch: { archived: !game.archived },
      })
    );
  }, [dispatch, selectedGameId, game]);

  const removeGame = useCallback(async (): Promise<boolean> => {
    if (selectedGameId === null) return false;
    try {
      await dispatch(deleteGameThunk(selectedGameId)).unwrap();
      return true;
    } catch {
      return false;
    }
  }, [dispatch, selectedGameId]);

  const updateExecutables = useCallback(
    async (executables: string[]): Promise<boolean> => {
      if (selectedGameId === null) return false;
      try {
        await dispatch(
          updateGameThunk({ id: selectedGameId, patch: { executables } })
        ).unwrap();
        return true;
      } catch {
        return false;
      }
    },
    [dispatch, selectedGameId]
  );

  const playExecutable = useCallback(
    (executable?: string) => {
      if (selectedGameId === null) return;
      void dispatch(launchGameThunk({ id: selectedGameId, executable }));
    },
    [dispatch, selectedGameId]
  );

  const openFolder = useCallback(
    (executable?: string) => {
      if (selectedGameId === null) return;
      void dispatch(openGameFolderThunk({ id: selectedGameId, executable }));
    },
    [dispatch, selectedGameId]
  );

  const browsePath = useCallback(
    (mode: "file" | "folder"): Promise<string | null> => {
      const label = game?.name ?? "game";
      const title =
        mode === "folder"
          ? `Select folder for ${label}`
          : `Select executable for ${label}`;
      return pickLocalPath(mode, title);
    },
    [game?.name]
  );

  const dismissLaunchError = useCallback(() => {
    dispatch(clearLaunchError());
  }, [dispatch]);

  return {
    selectedGameId,
    game,
    loading,
    error,
    mutating,
    refreshing,
    launching,
    launchError,
    tagHighlights,
    reIndex,
    updateRating,
    saveNotes,
    toggleArchive,
    removeGame,
    updateExecutables,
    playExecutable,
    openFolder,
    browsePath,
    dismissLaunchError,
  };
}
