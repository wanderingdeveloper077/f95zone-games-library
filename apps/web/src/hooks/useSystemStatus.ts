import { useCallback, useEffect } from "react";
import { applyThemeToDocument } from "@/lib/theme";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  cancelJobThunk,
  fetchAccountsThunk,
  fetchSettingsThunk,
} from "@/store/slices/systemSlice";

export function useSystemStatus() {
  const dispatch = useAppDispatch();
  const sseConnected = useAppSelector((s) => s.system.sseConnected);
  const activeJob = useAppSelector((s) => s.system.activeJob);
  const currentItemName = useAppSelector((s) => s.system.currentItemName);
  const lastJobError = useAppSelector((s) => s.system.lastJobError);
  const f95Account = useAppSelector((s) =>
    s.system.accounts.find((a) => a.id === "f95zone")
  );
  const sfwMode = useAppSelector(
    (s) => s.system.settings?.sfwMode ?? s.system.cachedSfwMode
  );
  const activeTheme = useAppSelector(
    (s) =>
      s.system.previewTheme ??
      s.system.settings?.theme ??
      s.system.cachedTheme
  );

  useEffect(() => {
    void dispatch(fetchAccountsThunk());
    void dispatch(fetchSettingsThunk());
  }, [dispatch]);

  useEffect(() => {
    applyThemeToDocument(activeTheme);
    if (
      activeTheme !== "system" ||
      typeof window === "undefined" ||
      typeof window.matchMedia !== "function"
    ) {
      return;
    }

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => applyThemeToDocument("system");
    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, [activeTheme]);

  const cancelJob = useCallback(
    (jobId: string) => {
      void dispatch(cancelJobThunk(jobId));
    },
    [dispatch]
  );

  return {
    sseConnected,
    activeJob,
    currentItemName,
    lastJobError,
    accountStatus: f95Account?.status,
    sfwMode,
    cancelJob,
  };
}
