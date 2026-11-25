import type { SseEvent } from "@game-library/shared";
import { useEffect } from "react";
import { API_BASE_URL } from "@/services/api";
import { subscribeToEvents } from "@/services/eventsService";
import { useAppDispatch, useAppStore } from "@/store/hooks";
import { fetchGameDetailThunk, fetchGamesThunk } from "@/store/slices/gamesSlice";
import {
  sseAccountUpdated,
  sseConnectionChanged,
  sseJobCompleted,
  sseJobFailed,
  sseJobProgress,
  sseJobStarted,
} from "@/store/slices/systemSlice";

export function useSseEvents(): void {
  const dispatch = useAppDispatch();
  const appStore = useAppStore();

  useEffect(() => {
    const handleEvent = (event: SseEvent) => {
      switch (event.type) {
        case "connected":
          dispatch(sseConnectionChanged(true));
          break;
        case "job_started":
          dispatch(sseJobStarted(event.job));
          break;
        case "job_progress":
          dispatch(
            sseJobProgress({
              job: event.job,
              currentGameName: event.currentGameName,
            })
          );
          break;
        case "job_completed": {
          dispatch(sseJobCompleted());
          const { filter } = appStore.getState().games;
          void dispatch(
            fetchGamesThunk({ filter, preserveLoadedCount: true })
          );
          break;
        }
        case "job_failed":
          dispatch(sseJobFailed(event.error));
          break;
        case "game_updated": {
          const { filter, selectedGameId } = appStore.getState().games;
          void dispatch(
            fetchGamesThunk({ filter, preserveLoadedCount: true })
          );
          if (selectedGameId === event.gameId) {
            void dispatch(fetchGameDetailThunk(event.gameId));
          }
          break;
        }
        case "games_added": {
          const { filter } = appStore.getState().games;
          void dispatch(
            fetchGamesThunk({ filter, preserveLoadedCount: true })
          );
          break;
        }
        case "account_updated":
          dispatch(sseAccountUpdated(event.account));
          break;
      }
    };

    const connect = () =>
      subscribeToEvents(`${API_BASE_URL}/api/events`, {
        onOpen: () => dispatch(sseConnectionChanged(true)),
        onError: () => dispatch(sseConnectionChanged(false)),
        onEvent: handleEvent,
      });

    let closeSse: (() => void) | null = connect();

    // Close the SSE stream immediately when leaving/closing the tab so bfcache
    // does not delay server idle shutdown.
    const handlePageHide = () => {
      closeSse?.();
      closeSse = null;
      dispatch(sseConnectionChanged(false));
    };

    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted && !closeSse) {
        closeSse = connect();
        const { filter } = appStore.getState().games;
        void dispatch(fetchGamesThunk({ filter, preserveLoadedCount: true }));
      }
    };

    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("pageshow", handlePageShow);

    return () => {
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("pageshow", handlePageShow);
      closeSse?.();
      closeSse = null;
    };
  }, [dispatch, appStore]);
}
