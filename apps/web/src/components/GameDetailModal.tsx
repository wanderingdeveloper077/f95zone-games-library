import {
  STATUS_META,
  type StatusId,
  TAG_BY_ID,
  TYPE_META,
  type TypeId,
} from "@game-library/shared";
import {
  AlertCircle,
  Archive,
  ExternalLink,
  Loader2,
  Play,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { DismissibleAlert } from "@/components/DismissibleAlert";
import { GameExecutablesSection } from "@/components/game-detail/GameExecutablesSection";
import {
  type GameDetailTab,
  GameDetailTabs,
} from "@/components/game-detail/GameDetailTabs";
import { GameNotesForm } from "@/components/game-detail/GameNotesForm";
import { StarRating } from "@/components/game-detail/StarRating";
import { TagBadge } from "@/components/TagBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { useGameDetail } from "@/hooks/useGameDetail";
import { getSfwImageBlurClass } from "@/lib/gamePresentation";
import { cn } from "@/lib/utils";

interface GameDetailModalProps {
  onClose: () => void;
}

export function GameDetailModal({ onClose }: GameDetailModalProps) {
  const {
    selectedGameId,
    game,
    loading,
    error,
    mutating,
    refreshing,
    launching,
    launchError,
    tagHighlights,
    downloadGalleryImages,
    sfwMode,
    reIndex,
    updateRating,
    saveNotes,
    toggleArchive,
    removeGame,
    updateExecutables,
    playExecutable,
    openFolder,
    browsePath,
    dismissLaunchError,
  } = useGameDetail();

  const [rating, setRating] = useState(0);
  const [tab, setTab] = useState<GameDetailTab>("overview");

  const gameRating = game?.rating;
  const executables = game?.executables ?? [];

  useEffect(() => {
    if (selectedGameId !== null) {
      setTab("overview");
    }
  }, [selectedGameId]);

  useEffect(() => {
    if (selectedGameId !== null && gameRating !== undefined) {
      setRating(gameRating);
    }
  }, [selectedGameId, gameRating]);

  return (
    <Dialog
      open={selectedGameId !== null}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
        <DialogHeader className="flex flex-row items-center justify-between gap-2 border-b border-border px-5 py-3.5 pr-12">
          <div className="min-w-0 flex-1">
            <DialogTitle className="truncate text-base">
              {game?.name ?? "Loading..."}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Game metadata, gallery, downloads, reviews, and personal library notes.
            </DialogDescription>
          </div>
          <div className="flex items-center gap-2">
            {game && executables.length === 1 && selectedGameId !== null && (
              <Button
                type="button"
                size="xs"
                onClick={() => playExecutable(executables[0])}
                disabled={launching}
                className="bg-emerald-600/90 text-white hover:bg-emerald-500"
              >
                <Play className="h-3.5 w-3.5" />
                Play
              </Button>
            )}
            {game && !game.custom && selectedGameId !== null && (
              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={reIndex}
                disabled={refreshing}
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`}
                />
                Re-index
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-5">
          {error ? (
            <DismissibleAlert
              variant="destructive"
              icon={<AlertCircle className="h-4 w-4 shrink-0" />}
            >
              {error}
            </DismissibleAlert>
          ) : loading || !game || selectedGameId === null ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <div className="space-y-5">
              <div className="grid gap-4 md:grid-cols-[260px_1fr]">
                <div className="overflow-hidden rounded-xl border border-border bg-card">
                  {game.coverFile ? (
                    <img
                      src={`/covers/${encodeURIComponent(game.coverFile)}`}
                      alt={game.name}
                      className={cn(
                        "h-44 w-full object-cover transition duration-200",
                        getSfwImageBlurClass(sfwMode)
                      )}
                    />
                  ) : (
                    <div className="flex h-44 items-center justify-center text-xs text-muted-foreground">
                      No cached cover
                    </div>
                  )}
                </div>

                <div className="flex flex-col justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <Badge
                        className="rounded border-transparent px-2 py-0.5 font-semibold text-white"
                        style={{
                          backgroundColor:
                            TYPE_META[game.type as TypeId]?.color ?? "#444",
                        }}
                      >
                        {TYPE_META[game.type as TypeId]?.label ?? "Misc"}
                      </Badge>
                      <Badge
                        variant="secondary"
                        className="rounded px-2 py-0.5 font-medium"
                        style={{
                          color:
                            STATUS_META[game.status as StatusId]?.color ??
                            "#eee",
                        }}
                      >
                        {STATUS_META[game.status as StatusId]?.label ??
                          "Unknown"}
                      </Badge>
                      <Badge
                        variant="secondary"
                        className="rounded px-2 py-0.5 font-mono text-neutral-200"
                      >
                        {game.version}
                      </Badge>
                      {game.url && (
                        <a
                          href={game.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-rose-400 hover:underline"
                        >
                          Open Thread <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Developer:{" "}
                      <span className="text-foreground">
                        {game.developer || "Unknown"}
                      </span>
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Forum Score:{" "}
                      <span className="text-amber-300">
                        {game.score > 0
                          ? `${game.score.toFixed(1)} / 5 (${game.votes} reviews)`
                          : "Unrated"}
                      </span>
                    </p>
                    {game.lastError && (
                      <DismissibleAlert
                        variant="destructive"
                        icon={<AlertCircle className="h-3.5 w-3.5 shrink-0" />}
                        className="mt-2 py-1.5"
                      >
                        Last indexer error: {game.lastError}
                      </DismissibleAlert>
                    )}
                  </div>

                  <StarRating
                    value={rating}
                    onChange={(next) => {
                      setRating(next);
                      updateRating(next);
                    }}
                  />
                </div>
              </div>

              {game.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {game.tags.map((tagId) => {
                    const meta = TAG_BY_ID.get(tagId);
                    if (!meta) return null;
                    return (
                      <TagBadge
                        key={tagId}
                        highlight={tagHighlights?.[meta.text]}
                      >
                        {meta.text}
                      </TagBadge>
                    );
                  })}
                </div>
              )}

              <GameExecutablesSection
                gameId={selectedGameId}
                executables={executables}
                mutating={mutating}
                launching={launching}
                launchError={launchError}
                onDismissError={dismissLaunchError}
                onUpdateExecutables={updateExecutables}
                onPlay={(exe) => playExecutable(exe)}
                onOpenFolder={(exe) => openFolder(exe)}
                onBrowse={browsePath}
              />

              <GameDetailTabs
                content={game}
                downloadGalleryImages={downloadGalleryImages}
                sfwMode={sfwMode}
                activeTab={tab}
                onTabChange={setTab}
              />

              <GameNotesForm
                gameId={selectedGameId}
                initialNotes={game.notes}
                saving={mutating}
                onSave={saveNotes}
              />

              <Separator />

              <div className="flex items-center justify-between">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={toggleArchive}
                  disabled={mutating}
                >
                  <Archive className="h-3.5 w-3.5" />
                  {game.archived ? "Unarchive" : "Archive"}
                </Button>

                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    void removeGame().then((deleted) => {
                      if (deleted) onClose();
                    });
                  }}
                  disabled={mutating}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Remove Game
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
