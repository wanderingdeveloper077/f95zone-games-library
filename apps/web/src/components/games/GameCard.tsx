import {
  type GameSummary,
  STATUS_META,
  type StatusId,
  TYPE_META,
  type TypeId,
} from "@game-library/shared";
import { AlertCircle, ExternalLink, ImageOff, Play, Star } from "lucide-react";
import { GameStateActions } from "@/components/games/GameStateActions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { formatUnixDate } from "@/lib/gamePresentation";
import { cn } from "@/lib/utils";

export interface GameCardProps {
  game: GameSummary;
  launching?: boolean;
  onSelect: (id: number) => void;
  onPlay: (game: GameSummary) => void;
  onToggleInstalled: (game: GameSummary) => void;
  onToggleFinished: (game: GameSummary) => void;
}

export function GameCard({
  game,
  launching = false,
  onSelect,
  onPlay,
  onToggleInstalled,
  onToggleFinished,
}: GameCardProps) {
  const typeMeta = TYPE_META[game.type as TypeId];
  const statusMeta = STATUS_META[game.status as StatusId];
  const hasExecutable = (game.executables?.length ?? 0) > 0;

  return (
    <Card
      onClick={() => onSelect(game.id)}
      className="group cursor-pointer gap-0 overflow-hidden bg-card/60 transition hover:border-neutral-600 hover:bg-card"
    >
      <div className="relative aspect-[16/7] w-full overflow-hidden bg-background">
        {game.coverFile ? (
          <img
            src={`/covers/${encodeURIComponent(game.coverFile)}`}
            alt={game.name}
            loading="lazy"
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-neutral-700">
            <ImageOff className="h-8 w-8" />
          </div>
        )}

        <div className="absolute top-2 left-2 flex flex-wrap items-center gap-1.5">
          <Badge
            className="rounded border-transparent px-1.5 py-0.5 text-[10px] font-semibold text-white shadow"
            style={{ backgroundColor: typeMeta?.color ?? "#393939" }}
          >
            {typeMeta?.label ?? "Misc"}
          </Badge>
          <Badge
            variant="outline"
            className="rounded border-transparent bg-background/85 px-1.5 py-0.5 text-[10px] font-medium backdrop-blur"
            style={{ color: statusMeta?.color ?? "#F2F2F2" }}
          >
            {statusMeta?.label ?? "Unknown"}
          </Badge>
        </div>

        {game.hasUpdate && (
          <Badge className="absolute top-2 right-2 rounded border-transparent bg-amber-500 px-2 py-0.5 text-[10px] font-bold tracking-wide text-neutral-950 uppercase shadow">
            Update Available
          </Badge>
        )}

        {game.lastError && (
          <div
            className="absolute right-2 bottom-2 rounded bg-rose-950/90 p-1 text-rose-300"
            title={game.lastError}
          >
            <AlertCircle className="h-3.5 w-3.5" />
          </div>
        )}
      </div>

      <CardContent className="flex flex-1 flex-col justify-between p-3.5">
        <div>
          <div className="flex items-start justify-between gap-2">
            <h2 className="line-clamp-1 text-sm font-semibold text-foreground">
              {game.name}
            </h2>
            {game.url && (
              <Button
                asChild
                variant="ghost"
                size="icon-sm"
                className="-mt-1 -mr-1 h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground"
              >
                <a
                  href={game.url}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  title="Open thread in browser"
                  aria-label="Open thread in browser"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </Button>
            )}
          </div>

          <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
            {game.developer || "Unknown developer"}
          </p>

          <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[11px] text-neutral-300">
            <Badge variant="secondary" className="rounded font-mono">
              {game.version}
            </Badge>
            <span className="text-muted-foreground">
              {formatUnixDate(game.lastUpdatedTsSec)}
            </span>
            {game.score > 0 && (
              <span className="ml-auto inline-flex items-center gap-1 text-amber-300">
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                {game.score.toFixed(1)}
                <span className="text-muted-foreground">({game.votes})</span>
              </span>
            )}
          </div>
        </div>
      </CardContent>

      <CardFooter
        className="flex items-center gap-2 border-t border-border/80 px-3.5 py-2.5"
        onClick={(e) => e.stopPropagation()}
      >
        <Button
          type="button"
          size="xs"
          variant={hasExecutable ? "default" : "secondary"}
          disabled={launching}
          onClick={() => onPlay(game)}
          title={
            hasExecutable
              ? "Play game"
              : "Add a game executable in details to play"
          }
          className={cn(
            "shrink-0",
            hasExecutable && "bg-emerald-600/90 text-white hover:bg-emerald-500"
          )}
        >
          <Play className="h-3 w-3" />
          Play
        </Button>
        <GameStateActions
          game={game}
          layout="stretch"
          onToggleInstalled={() => onToggleInstalled(game)}
          onToggleFinished={() => onToggleFinished(game)}
        />
      </CardFooter>
    </Card>
  );
}
