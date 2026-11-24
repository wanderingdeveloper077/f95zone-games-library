import type { GameSummary } from "@game-library/shared";
import { Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface ChooseExecutableDialogProps {
  game: GameSummary | null;
  launching: boolean;
  onSelect: (game: GameSummary, executable: string) => void;
  onClose: () => void;
}

export function ChooseExecutableDialog({
  game,
  launching,
  onSelect,
  onClose,
}: ChooseExecutableDialogProps) {
  return (
    <Dialog
      open={game !== null}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="truncate text-base">
            Play {game?.name}
          </DialogTitle>
          <DialogDescription>
            Choose which executable to launch for this game.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {game &&
            (game.executables ?? []).map((exe) => (
              <Button
                key={exe}
                type="button"
                variant="outline"
                disabled={launching}
                onClick={() => {
                  onSelect(game, exe);
                  onClose();
                }}
                className="h-auto w-full justify-start gap-2.5 px-3 py-2 text-left"
              >
                <Play className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                <span title={exe} className="min-w-0 flex-1 truncate font-mono text-xs">
                  {exe}
                </span>
              </Button>
            ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
