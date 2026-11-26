import {
  STATUS_META,
  type StatusId,
  TYPE_META,
  type TypeId,
} from "@game-library/shared";
import {
  AlertCircle,
  Check,
  CheckCheck,
  Download,
  ExternalLink,
  ImageOff,
  Play,
  Star,
} from "lucide-react";
import type { GameCardProps } from "@/components/games/GameCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { getGameInstallState, getSfwImageBlurClass } from "@/lib/gamePresentation";
import { cn } from "@/lib/utils";

/**
 * Compact high-density card rendered in Small Grid view, preserving the same
 * `GameCardProps` contract as `GameCard` for drop-in substitutability.
 */
export function GameSmallCard({
  game,
  sfwMode = false,
  launching = false,
  onSelect,
  onPlay,
  onToggleInstalled,
  onToggleFinished,
}: GameCardProps) {
  const typeMeta = TYPE_META[game.type as TypeId];
  const statusMeta = STATUS_META[game.status as StatusId];
  const hasExecutable = (game.executables?.length ?? 0) > 0;
  const { isInstalledCurrent, isInstalledOld, isFinishedCurrent } =
    getGameInstallState(game);

  const installedLabel = isInstalledCurrent
    ? `Installed (${game.installedVersion})`
    : isInstalledOld
      ? `Outdated (${game.installedVersion} installed)`
      : "Mark installed";

  const finishedLabel = isFinishedCurrent
    ? "Finished (current version)"
    : "Mark finished";

  return (
    <Card
      onClick={() => onSelect(game.id)}
      className="group cursor-pointer gap-0 overflow-hidden bg-card/60 transition hover:border-neutral-600 hover:bg-card"
    >
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-background">
        {game.coverFile ? (
          <img
            src={`/covers/${encodeURIComponent(game.coverFile)}`}
            alt={game.name}
            loading="lazy"
            className={cn(
              "h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]",
              getSfwImageBlurClass(sfwMode)
            )}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-neutral-700">
            <ImageOff className="h-5 w-5" />
          </div>
        )}

        <div className="absolute top-1.5 left-1.5 flex max-w-[78%] flex-wrap items-center gap-1">
          <Badge
            className="rounded border-transparent px-1 py-0 text-[9px] font-semibold text-white shadow"
            style={{ backgroundColor: typeMeta?.color ?? "#393939" }}
          >
            {typeMeta?.label ?? "Misc"}
          </Badge>
          <Badge
            variant="outline"
            className="rounded border-transparent bg-background/85 px-1 py-0 text-[9px] font-medium backdrop-blur"
            style={{ color: statusMeta?.color ?? "#F2F2F2" }}
          >
            {statusMeta?.label ?? "Unknown"}
          </Badge>
        </div>

        {game.hasUpdate && (
          <Badge className="absolute top-1.5 right-1.5 rounded border-transparent bg-amber-500 px-1.5 py-0 text-[9px] font-bold tracking-wide text-neutral-950 uppercase shadow">
            Update
          </Badge>
        )}

        {game.url && (
          <Button
            asChild
            variant="ghost"
            size="icon-sm"
            className={cn(
              "absolute right-1.5 h-5 w-5 rounded bg-background/80 text-muted-foreground backdrop-blur hover:bg-background hover:text-foreground",
              game.hasUpdate ? "bottom-1.5" : "top-1.5"
            )}
          >
            <a
              href={game.url}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              title="Open thread in browser"
              aria-label="Open thread in browser"
            >
              <ExternalLink className="h-3 w-3" />
            </a>
          </Button>
        )}

        {game.lastError && (
          <div
            className="absolute bottom-1.5 left-1.5 rounded bg-rose-950/90 p-0.5 text-rose-300"
            title={game.lastError}
          >
            <AlertCircle className="h-3 w-3" />
          </div>
        )}
      </div>

      <CardContent className="flex flex-1 flex-col justify-between gap-1.5 p-2.5">
        <h2
          title={game.name}
          className="line-clamp-1 text-xs font-semibold text-foreground"
        >
          {game.name}
        </h2>

        <div className="flex items-center justify-between gap-1.5 text-[10px] text-muted-foreground">
          <Badge
            variant="secondary"
            className="max-w-[65%] truncate rounded px-1.5 py-0 font-mono text-[10px]"
            title={game.version}
          >
            {game.version}
          </Badge>

          {game.score > 0 ? (
            <span className="inline-flex shrink-0 items-center gap-0.5 text-amber-300">
              <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />
              {game.score.toFixed(1)}
            </span>
          ) : game.developer ? (
            <span className="min-w-0 truncate" title={game.developer}>
              {game.developer}
            </span>
          ) : null}
        </div>
      </CardContent>

      <CardFooter
        className="flex items-center justify-between gap-1.5 border-t border-border/70 px-2 py-1.5"
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
            "h-6 px-2 text-[11px]",
            hasExecutable && "bg-emerald-600/90 text-white hover:bg-emerald-500"
          )}
        >
          <Play className="h-3 w-3" />
          Play
        </Button>

        <div className="inline-flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => onToggleInstalled(game)}
            title={installedLabel}
            aria-label={installedLabel}
            className={cn(
              "h-6 w-6",
              isInstalledCurrent
                ? "bg-emerald-600/30 text-emerald-300 hover:bg-emerald-600/40 hover:text-emerald-200"
                : isInstalledOld
                  ? "bg-amber-600/30 text-amber-300 hover:bg-amber-600/40 hover:text-amber-200"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
            )}
          >
            <Download className="h-3 w-3" />
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => onToggleFinished(game)}
            title={finishedLabel}
            aria-label={finishedLabel}
            className={cn(
              "h-6 w-6",
              isFinishedCurrent
                ? "bg-sky-600/30 text-sky-300 hover:bg-sky-600/40 hover:text-sky-200"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            )}
          >
            {isFinishedCurrent ? (
              <CheckCheck className="h-3 w-3" />
            ) : (
              <Check className="h-3 w-3" />
            )}
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
