import type { GameSummary } from "@game-library/shared";
import type * as React from "react";
import { GameCard } from "@/components/games/GameCard";
import { GameListTable } from "@/components/games/GameListTable";
import { Card } from "@/components/ui/card";

export interface GameGridProps {
  games: GameSummary[];
  viewMode: "grid" | "list";
  launchingGameId?: number | null;
  onSelectGame: (id: number) => void;
  onPlayGame: (game: GameSummary) => void;
  onToggleInstalled: (game: GameSummary) => void;
  onToggleFinished: (game: GameSummary) => void;
  emptyState?: React.ReactNode;
}

export function GameGrid({
  games,
  viewMode,
  launchingGameId,
  onSelectGame,
  onPlayGame,
  onToggleInstalled,
  onToggleFinished,
  emptyState,
}: GameGridProps) {
  if (games.length === 0) {
    return (
      emptyState ?? (
        <Card className="mx-auto mt-12 max-w-lg rounded-2xl border-dashed bg-card/40 p-10 text-center">
          <p className="text-sm font-medium text-foreground">
            Your library is empty (or no games match the active filters).
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Add an F95zone thread URL, import your Watched/Bookmarks, or use the
            browser extension while browsing F95zone.
          </p>
        </Card>
      )
    );
  }

  if (viewMode === "list") {
    return (
      <div className="mx-auto mt-4 max-w-7xl px-4 pb-12">
        <GameListTable
          games={games}
          launchingGameId={launchingGameId}
          onSelectGame={onSelectGame}
          onPlayGame={onPlayGame}
          onToggleInstalled={onToggleInstalled}
          onToggleFinished={onToggleFinished}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto mt-4 grid max-w-7xl grid-cols-1 gap-4 px-4 pb-12 sm:grid-cols-2 lg:grid-cols-3">
      {games.map((game) => (
        <GameCard
          key={game.id}
          game={game}
          launching={launchingGameId === game.id}
          onSelect={onSelectGame}
          onPlay={onPlayGame}
          onToggleInstalled={onToggleInstalled}
          onToggleFinished={onToggleFinished}
        />
      ))}
    </div>
  );
}
