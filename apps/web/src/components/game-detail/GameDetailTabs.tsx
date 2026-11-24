import type { GameDetail } from "@game-library/shared";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type GameDetailTab = "overview" | "changelog" | "downloads" | "reviews";

export interface GameDetailTabsProps {
  content: Pick<
    GameDetail,
    "description" | "changelog" | "downloads" | "reviews"
  >;
  activeTab: GameDetailTab;
  onTabChange: (tab: GameDetailTab) => void;
}

export function GameDetailTabs({
  content,
  activeTab,
  onTabChange,
}: GameDetailTabsProps) {
  return (
    <Tabs
      value={activeTab}
      onValueChange={(value) => onTabChange(value as GameDetailTab)}
      className="w-full"
    >
      <TabsList className="w-full justify-start">
        <TabsTrigger value="overview" className="flex-none">
          Overview
        </TabsTrigger>
        <TabsTrigger value="changelog" className="flex-none">
          Changelog
        </TabsTrigger>
        <TabsTrigger value="downloads" className="flex-none">
          Downloads ({content.downloads.length})
        </TabsTrigger>
        <TabsTrigger value="reviews" className="flex-none">
          Reviews ({content.reviews.length})
        </TabsTrigger>
      </TabsList>

      <TabsContent
        value="overview"
        className="max-h-60 overflow-y-auto rounded-xl border border-border bg-card/50 p-3.5 text-xs leading-relaxed text-foreground"
      >
        <pre className="whitespace-pre-wrap font-sans">
          {content.description || "No description parsed yet."}
        </pre>
      </TabsContent>

      <TabsContent
        value="changelog"
        className="max-h-60 overflow-y-auto rounded-xl border border-border bg-card/50 p-3.5 text-xs leading-relaxed text-foreground"
      >
        <pre className="whitespace-pre-wrap font-sans">
          {content.changelog || "No changelog parsed yet."}
        </pre>
      </TabsContent>

      <TabsContent
        value="downloads"
        className="max-h-60 overflow-y-auto rounded-xl border border-border bg-card/50 p-3.5 text-xs leading-relaxed text-foreground"
      >
        <div className="space-y-3">
          {content.downloads.length === 0 ? (
            <p className="text-muted-foreground">
              No download links extracted.
            </p>
          ) : (
            content.downloads.map((sec, i) => (
              <div key={i}>
                <div className="font-semibold text-foreground">
                  {sec.name || "Downloads"}
                </div>
                <div className="mt-1 flex flex-wrap gap-2">
                  {sec.mirrors.map((m, j) => (
                    <Button
                      key={j}
                      asChild
                      variant="secondary"
                      size="xs"
                      className="border border-border text-rose-300"
                    >
                      <a href={m.url} target="_blank" rel="noreferrer">
                        {m.label || "Mirror"}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </Button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </TabsContent>

      <TabsContent
        value="reviews"
        className="max-h-60 overflow-y-auto rounded-xl border border-border bg-card/50 p-3.5 text-xs leading-relaxed text-foreground"
      >
        <div className="space-y-3">
          {content.reviews.length === 0 ? (
            <p className="text-muted-foreground">No reviews cached.</p>
          ) : (
            content.reviews.map((rev, i) => (
              <div
                key={i}
                className="border-b border-border pb-2.5 last:border-none"
              >
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span className="font-semibold text-foreground">
                    {rev.user}
                  </span>
                  <span className="text-amber-300">
                    {rev.score.toFixed(1)} / 5
                  </span>
                </div>
                <p className="mt-1 text-neutral-300">{rev.message}</p>
              </div>
            ))
          )}
        </div>
      </TabsContent>
    </Tabs>
  );
}
