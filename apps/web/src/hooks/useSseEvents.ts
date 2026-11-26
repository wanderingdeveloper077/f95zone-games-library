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

function createSseClientId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return `tab-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

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
          dispatch(sseJobCompleted(event.job));
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

    let currentClientId: string | null = null;

    const connect = () => {
      const clientId = createSseClientId();
      currentClientId = clientId;
      return subscribeToEvents(
        `${API_BASE_URL}/api/events?clientId=${encodeURIComponent(clientId)}`,
        {
          onOpen: () => dispatch(sseConnectionChanged(true)),
          onError: () => dispatch(sseConnectionChanged(false)),
          onEvent: handleEvent,
        }
      );
    };

    let closeSse: (() => void) | null = connect();

    // Close the SSE stream and notify the server immediately when leaving/closing
    // the tab so shutdown is not delayed by OS socket teardown or bfcache.
    const handlePageHide = () => {
      const closingId = currentClientId;
      currentClientId = null;
      closeSse?.();
      closeSse = null;
      dispatch(sseConnectionChanged(false));
      if (
        closingId &&
        typeof navigator !== "undefined" &&
        typeof navigator.sendBeacon === "function"
      ) {
        navigator.sendBeacon(
          `${API_BASE_URL}/api/system/client-closing?clientId=${encodeURIComponent(closingId)}`
        );
      }
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
      currentClientId = null;
      closeSse?.();
      closeSse = null;
    };
  }, [dispatch, appStore]);
}
