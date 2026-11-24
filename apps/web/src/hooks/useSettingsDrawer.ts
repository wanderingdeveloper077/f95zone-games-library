import { useCallback, useEffect } from "react";
import type {
  IndexerSettingsFormValues,
  TagHighlightFormValues,
} from "@/schemas/forms";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { importF95ListThunk } from "@/store/slices/gamesSlice";
import {
  clearF95AccountThunk,
  clearStatusNotice,
  createPairingCodeThunk,
  fetchPairingStatusThunk,
  rotatePairingTokenThunk,
  setStatusNotice,
  updateSettingsThunk,
  verifyF95AccountThunk,
} from "@/store/slices/systemSlice";

export function useSettingsDrawer(open: boolean) {
  const dispatch = useAppDispatch();
  const f95Account = useAppSelector((s) =>
    s.system.accounts.find((a) => a.id === "f95zone")
  );
  const settings = useAppSelector((s) => s.system.settings);
  const settingsSaving = useAppSelector((s) => s.system.settingsSaving);
  const settingsError = useAppSelector((s) => s.system.settingsError);
  const pairing = useAppSelector((s) => s.system.pairing);
  const pairingLoading = useAppSelector((s) => s.system.pairingLoading);
  const pairingError = useAppSelector((s) => s.system.pairingError);
  const accountsError = useAppSelector((s) => s.system.accountsError);
  const verifyingAccount = useAppSelector((s) => s.system.verifyingAccount);
  const statusNotice = useAppSelector((s) => s.system.statusNotice);
  const importing = useAppSelector((s) => s.games.refreshing);

  useEffect(() => {
    if (open) {
      dispatch(clearStatusNotice());
      void dispatch(fetchPairingStatusThunk());
    }
  }, [open, dispatch]);

  const generatePairingCode = useCallback(() => {
    void dispatch(createPairingCodeThunk());
  }, [dispatch]);

  const rotatePairingToken = useCallback(() => {
    void dispatch(rotatePairingTokenThunk());
  }, [dispatch]);

  const verifySession = useCallback(() => {
    void dispatch(verifyF95AccountThunk());
  }, [dispatch]);

  const importList = useCallback(
    async (source: "watched" | "bookmarks") => {
      try {
        await dispatch(importF95ListThunk(source)).unwrap();
        dispatch(setStatusNotice(`Started ${source} import job.`));
      } catch {
        // Error surfaced in Redux games.error / system
      }
    },
    [dispatch]
  );

  const clearSession = useCallback(() => {
    void dispatch(clearF95AccountThunk());
  }, [dispatch]);

  const savePreferences = useCallback(
    async (values: IndexerSettingsFormValues): Promise<boolean> => {
      try {
        await dispatch(updateSettingsThunk(values)).unwrap();
        dispatch(setStatusNotice("Indexer and extension settings saved."));
        return true;
      } catch {
        return false;
      }
    },
    [dispatch]
  );

  const addTagHighlight = useCallback(
    async (values: TagHighlightFormValues): Promise<boolean> => {
      if (!settings) return false;
      try {
        await dispatch(
          updateSettingsThunk({
            tagHighlights: {
              ...settings.tagHighlights,
              [values.tagText]: values.level,
            },
          })
        ).unwrap();
        return true;
      } catch {
        return false;
      }
    },
    [dispatch, settings]
  );

  const removeTagHighlight = useCallback(
    async (tagName: string): Promise<void> => {
      if (!settings) return;
      const next = { ...settings.tagHighlights };
      delete next[tagName];
      try {
        await dispatch(updateSettingsThunk({ tagHighlights: next })).unwrap();
      } catch {
        // Error surfaced via settingsError
      }
    },
    [dispatch, settings]
  );

  return {
    f95Account,
    settings,
    settingsSaving,
    pairing,
    pairingLoading,
    verifyingAccount,
    importing,
    statusNotice,
    errorMessage: pairingError ?? accountsError ?? settingsError,
    generatePairingCode,
    rotatePairingToken,
    verifySession,
    importList,
    clearSession,
    savePreferences,
    addTagHighlight,
    removeTagHighlight,
  };
}
