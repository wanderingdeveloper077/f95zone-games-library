import type { AccountStatusValue } from "@game-library/shared";
import {
  Plus,
  RefreshCw,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Wifi,
  WifiOff,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getSessionStatusPresentation } from "@/lib/gamePresentation";

export interface HeaderBarProps {
  totalGames: number;
  updatesCount: number;
  sseConnected: boolean;
  accountStatus: AccountStatusValue | undefined;
  isRefreshing: boolean;
  onAddClick: () => void;
  onRefreshAll: () => void;
  onOpenSettings: () => void;
}

export function HeaderBar({
  totalGames,
  updatesCount,
  sseConnected,
  accountStatus,
  isRefreshing,
  onAddClick,
  onRefreshAll,
  onOpenSettings,
}: HeaderBarProps) {
  const sessionBadge = getSessionStatusPresentation(accountStatus);

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-neutral-100 p-1 shadow-sm">
            <img
              src="/icons/128.png"
              alt="Game Library Manager"
              className="h-full w-full object-contain"
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-semibold tracking-tight text-foreground">
                Game Library Manager
              </h1>
              <Badge variant="secondary" className="rounded-full">
                {totalGames} games
              </Badge>
              {updatesCount > 0 && (
                <Badge variant="warning" className="rounded-full">
                  {updatesCount} updates
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                {sseConnected ? (
                  <Wifi className="h-3 w-3 text-emerald-400" />
                ) : (
                  <WifiOff className="h-3 w-3 text-rose-400" />
                )}
                {sseConnected ? "Live SSE connected" : "SSE reconnecting..."}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onOpenSettings}
            className={sessionBadge.headerButtonClass}
          >
            {sessionBadge.isWarning ? (
              <ShieldAlert className="h-3.5 w-3.5" />
            ) : (
              <ShieldCheck className="h-3.5 w-3.5" />
            )}
            {sessionBadge.headerLabel}
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onRefreshAll}
            disabled={isRefreshing}
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`}
            />
            Refresh All
          </Button>

          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={onAddClick}
          >
            <Plus className="h-3.5 w-3.5" />
            Add Game
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onOpenSettings}
            title="Pairing, Session & Settings"
          >
            <Settings className="h-3.5 w-3.5" />
            Settings & Pairing
          </Button>
        </div>
      </div>
    </header>
  );
}
