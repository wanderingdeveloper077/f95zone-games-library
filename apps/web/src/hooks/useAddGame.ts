import { useCallback } from "react";
import type { AddCustomGameFormValues } from "@/schemas/forms";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  clearCreateError,
  createGamesThunk,
  fetchGamesThunk,
} from "@/store/slices/gamesSlice";

export function useAddGame() {
  const dispatch = useAppDispatch();
  const creating = useAppSelector((s) => s.games.creating);
  const createError = useAppSelector((s) => s.games.createError);
  const filter = useAppSelector((s) => s.games.filter);

  const clearError = useCallback(() => {
    dispatch(clearCreateError());
  }, [dispatch]);

  const submitF95Urls = useCallback(
    async (urlsText: string): Promise<boolean> => {
      const urls = urlsText
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean);

      try {
        await dispatch(createGamesThunk({ urls, autoRefresh: true })).unwrap();
        void dispatch(fetchGamesThunk(filter));
        return true;
      } catch {
        return false;
      }
    },
    [dispatch, filter]
  );

  const submitCustomGame = useCallback(
    async (values: AddCustomGameFormValues): Promise<boolean> => {
      try {
        await dispatch(
          createGamesThunk({
            custom: true as const,
            name: values.name,
            version: values.version,
            developer: values.developer,
            url: values.url,
          })
        ).unwrap();
        void dispatch(fetchGamesThunk(filter));
        return true;
      } catch {
        return false;
      }
    },
    [dispatch, filter]
  );

  return {
    creating,
    createError,
    clearError,
    submitF95Urls,
    submitCustomGame,
  };
}
