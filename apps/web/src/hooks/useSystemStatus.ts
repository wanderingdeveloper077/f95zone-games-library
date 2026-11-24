import { useCallback, useEffect } from "react";
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

  useEffect(() => {
    void dispatch(fetchAccountsThunk());
    void dispatch(fetchSettingsThunk());
  }, [dispatch]);

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
    cancelJob,
  };
}
