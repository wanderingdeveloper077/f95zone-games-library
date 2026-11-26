import { ChevronLeft, ChevronRight, ExternalLink, Images } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getSfwImageBlurClass } from "@/lib/gamePresentation";
import { cn } from "@/lib/utils";

export function buildGalleryImageUrl(gameId: number, filename: string): string {
  return `/covers/gallery/${encodeURIComponent(String(gameId))}/${encodeURIComponent(filename)}`;
}

export function stepGalleryIndex(
  current: number,
  delta: number,
  total: number
): number {
  if (total <= 0) return 0;
  return (((current + delta) % total) + total) % total;
}

export interface GameGalleryTabProps {
  gameId: number;
  gameName: string;
  custom: boolean;
  galleryFiles: string[];
  downloadGalleryImages?: boolean;
  sfwMode?: boolean;
}

export function GameGalleryTab({
  gameId,
  gameName,
  custom,
  galleryFiles,
  downloadGalleryImages = true,
  sfwMode = false,
}: GameGalleryTabProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  useEffect(() => {
    setLightboxIndex(null);
  }, [gameId]);

  const activeIndex =
    lightboxIndex !== null && lightboxIndex < galleryFiles.length
      ? lightboxIndex
      : null;
  const activeFilename =
    activeIndex !== null ? galleryFiles[activeIndex] : undefined;
  const activeUrl =
    activeFilename !== undefined
      ? buildGalleryImageUrl(gameId, activeFilename)
      : undefined;

  if (galleryFiles.length === 0) {
    return (
      <div className="flex max-h-60 flex-col items-center justify-center gap-1.5 rounded-xl border border-border bg-card/50 p-6 text-center text-xs text-muted-foreground">
        <Images className="h-5 w-5 opacity-60" />
        <p>
          No gallery images cached yet.
          {!custom &&
            (downloadGalleryImages
              ? " Use Re-index above to fetch thread attachments."
              : " Gallery downloads are disabled in Settings.")}
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="max-h-72 overflow-y-auto rounded-xl border border-border bg-card/50 p-3.5">
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4">
          {galleryFiles.map((filename, index) => {
            const url = buildGalleryImageUrl(gameId, filename);
            return (
              <button
                key={filename}
                type="button"
                onClick={() => setLightboxIndex(index)}
                aria-label={`View ${gameName} gallery image ${index + 1} of ${galleryFiles.length}`}
                className="group relative cursor-pointer overflow-hidden rounded-lg border border-border bg-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <img
                  src={url}
                  alt={`${gameName} screenshot ${index + 1}`}
                  loading="lazy"
                  decoding="async"
                  className={cn(
                    "aspect-video w-full object-cover transition duration-200 group-hover:scale-[1.03]",
                    getSfwImageBlurClass(sfwMode)
                  )}
                />
              </button>
            );
          })}
        </div>
      </div>

      <Dialog
        open={activeIndex !== null}
        onOpenChange={(open) => {
          if (!open) setLightboxIndex(null);
        }}
      >
        <DialogContent
          className="max-h-[92vh] gap-0 overflow-hidden border-border bg-neutral-950/95 p-0 sm:max-w-5xl"
          onKeyDown={(e) => {
            if (activeIndex === null || galleryFiles.length <= 1) return;
            if (e.key === "ArrowLeft") {
              e.preventDefault();
              e.stopPropagation();
              setLightboxIndex((prev) =>
                stepGalleryIndex(
                  prev ?? activeIndex,
                  -1,
                  galleryFiles.length
                )
              );
            } else if (e.key === "ArrowRight") {
              e.preventDefault();
              e.stopPropagation();
              setLightboxIndex((prev) =>
                stepGalleryIndex(prev ?? activeIndex, 1, galleryFiles.length)
              );
            }
          }}
        >
          <DialogHeader className="flex flex-row items-center justify-between gap-3 border-b border-border px-4 py-3 pr-12">
            <DialogTitle className="truncate text-sm">
              {gameName} — Image {(activeIndex ?? 0) + 1} of{" "}
              {galleryFiles.length}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Full-size gallery image viewer. Use left and right arrow keys to
              navigate between images.
            </DialogDescription>
            {activeUrl && (
              <a
                href={activeUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex shrink-0 items-center gap-1 text-xs text-rose-400 hover:underline"
              >
                Open Full Size <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </DialogHeader>

          <div className="relative flex min-h-[50vh] max-h-[80vh] items-center justify-center bg-black/70 p-4">
            {activeUrl && (
              <img
                src={activeUrl}
                alt={`${gameName} screenshot ${(activeIndex ?? 0) + 1}`}
                className="max-h-[76vh] max-w-full rounded object-contain select-none"
              />
            )}

            {galleryFiles.length > 1 && activeIndex !== null && (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  aria-label="Previous image"
                  onClick={() =>
                    setLightboxIndex((prev) =>
                      stepGalleryIndex(
                        prev ?? activeIndex,
                        -1,
                        galleryFiles.length
                      )
                    )
                  }
                  className="absolute top-1/2 left-3 -translate-y-1/2 rounded-full bg-black/65 text-white hover:bg-black/85"
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  aria-label="Next image"
                  onClick={() =>
                    setLightboxIndex((prev) =>
                      stepGalleryIndex(
                        prev ?? activeIndex,
                        1,
                        galleryFiles.length
                      )
                    )
                  }
                  className="absolute top-1/2 right-3 -translate-y-1/2 rounded-full bg-black/65 text-white hover:bg-black/85"
                >
                  <ChevronRight className="h-5 w-5" />
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
