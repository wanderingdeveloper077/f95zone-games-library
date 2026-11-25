import type { GameSummary } from "@game-library/shared";
import { Loader2 } from "lucide-react";
import type * as React from "react";
import { GameCard } from "@/components/games/GameCard";
import { GameListTable } from "@/components/games/GameListTable";
import { GameSmallCard } from "@/components/games/GameSmallCard";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useInfiniteScroll } from "@/hooks/useInfiniteScroll";
import { DEFAULT_GAMES_PAGE_SIZE } from "@/services/gamesService";
import type { LibraryViewMode } from "@/store/slices/gamesSlice";

export interface GameGridProps {
  games: GameSummary[];
  totalCount: number;
  hasMore: boolean;
  loadingMore: boolean;
  viewMode: LibraryViewMode;
  launchingGameId?: number | null;
  onSelectGame: (id: number) => void;
  onPlayGame: (game: GameSummary) => void;
  onToggleInstalled: (game: GameSummary) => void;
  onToggleFinished: (game: GameSummary) => void;
  onLoadMore: () => void;
  emptyState?: React.ReactNode;
}

export function GameGrid({
  games,
  totalCount,
  hasMore,
  loadingMore,
  viewMode,
  launchingGameId,
  onSelectGame,
  onPlayGame,
  onToggleInstalled,
  onToggleFinished,
  onLoadMore,
  emptyState,
}: GameGridProps) {
  const sentinelRef = useInfiniteScroll({
    hasMore,
    loading: loadingMore,
    onLoadMore,
  });

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

  return (
    <>
      {viewMode === "list" ? (
        <div className="mx-auto mt-4 max-w-7xl px-4">
          <GameListTable
            games={games}
            launchingGameId={launchingGameId}
            onSelectGame={onSelectGame}
            onPlayGame={onPlayGame}
            onToggleInstalled={onToggleInstalled}
            onToggleFinished={onToggleFinished}
          />
        </div>
      ) : viewMode === "small-grid" ? (
        <div className="mx-auto mt-4 grid max-w-7xl grid-cols-2 gap-3 px-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {games.map((game) => (
            <GameSmallCard
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
      ) : (
        <div className="mx-auto mt-4 grid max-w-7xl grid-cols-1 gap-4 px-4 sm:grid-cols-2 lg:grid-cols-3">
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
      )}

      <div className="mx-auto flex max-w-7xl flex-col items-center gap-2 px-4 pt-4 pb-12">
        <div ref={sentinelRef} aria-hidden="true" className="h-1 w-full" />
        {loadingMore ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            Loading more games...
          </div>
        ) : hasMore ? (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={onLoadMore}
            className="text-muted-foreground hover:text-foreground"
          >
            Load more ({games.length} of {totalCount})
          </Button>
        ) : games.length > DEFAULT_GAMES_PAGE_SIZE ? (
          <p className="text-xs text-muted-foreground">
            Showing all {games.length} games
          </p>
        ) : null}
      </div>
    </>
  );
}
