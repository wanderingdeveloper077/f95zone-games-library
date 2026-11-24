import type { GameSummary } from "@game-library/shared";
import { Check, CheckCheck, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getGameInstallState } from "@/lib/gamePresentation";
import { cn } from "@/lib/utils";

export interface GameStateActionsProps {
  game: Pick<GameSummary, "version" | "installedVersion" | "finishedVersion">;
  layout: "compact" | "stretch";
  onToggleInstalled: () => void;
  onToggleFinished: () => void;
}

export function GameStateActions({
  game,
  layout,
  onToggleInstalled,
  onToggleFinished,
}: GameStateActionsProps) {
  const { isInstalledCurrent, isInstalledOld, isFinishedCurrent } =
    getGameInstallState(game);

  const isStretch = layout === "stretch";

  const installedLabel = isInstalledCurrent
    ? "Installed"
    : isInstalledOld
      ? isStretch
        ? `Old (${game.installedVersion})`
        : "Outdated"
      : isStretch
        ? "Mark Installed"
        : "Install";

  const finishedLabel = isFinishedCurrent
    ? "Finished"
    : isStretch
      ? "Mark Finished"
      : "Finished";

  return (
    <div
      className={cn(
        isStretch ? "flex w-full items-center gap-2" : "inline-flex items-center gap-1"
      )}
    >
      <Button
        type="button"
        variant="ghost"
        size="xs"
        onClick={onToggleInstalled}
        className={cn(
          isStretch && "flex-1",
          isInstalledCurrent
            ? isStretch
              ? "bg-emerald-600/25 text-emerald-300 ring-1 ring-emerald-600/40 hover:bg-emerald-600/35 hover:text-emerald-200"
              : "bg-emerald-600/30 text-emerald-300 hover:bg-emerald-600/40 hover:text-emerald-200"
            : isInstalledOld
              ? isStretch
                ? "bg-amber-600/25 text-amber-300 ring-1 ring-amber-600/40 hover:bg-amber-600/35 hover:text-amber-200"
                : "bg-amber-600/30 text-amber-300 hover:bg-amber-600/40 hover:text-amber-200"
              : isStretch
                ? "bg-secondary/80 text-secondary-foreground hover:bg-secondary"
                : "bg-secondary text-muted-foreground hover:text-foreground"
        )}
      >
        {isStretch && <Download className="h-3 w-3" />}
        {installedLabel}
      </Button>

      <Button
        type="button"
        variant="ghost"
        size="xs"
        onClick={onToggleFinished}
        className={cn(
          isStretch && "flex-1",
          isFinishedCurrent
            ? isStretch
              ? "bg-sky-600/25 text-sky-300 ring-1 ring-sky-600/40 hover:bg-sky-600/35 hover:text-sky-200"
              : "bg-sky-600/30 text-sky-300 hover:bg-sky-600/40 hover:text-sky-200"
            : isStretch
              ? "bg-secondary/80 text-secondary-foreground hover:bg-secondary"
              : "bg-secondary text-muted-foreground hover:text-foreground"
        )}
      >
        {isStretch &&
          (isFinishedCurrent ? (
            <CheckCheck className="h-3 w-3" />
          ) : (
            <Check className="h-3 w-3" />
          ))}
        {finishedLabel}
      </Button>
    </div>
  );
}
