import {
  STATUS_LIST,
  TAG_BY_ID,
  TAGS,
  TYPE_LIST,
} from "@game-library/shared";
import { RotateCcw, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type {
  FinishedFilterValue,
  GamesFilterState,
  InstalledFilterValue,
} from "@/services/gamesService";

const ALL_VALUE = "__all__";
const SELECTABLE_TAGS = TAGS.filter((t) => t.slug !== "unknown");

export interface AdvancedFiltersPanelProps {
  id: string;
  open: boolean;
  filter: GamesFilterState;
  activeCount: number;
  onChangeFilter: (next: GamesFilterState) => void;
}

export function AdvancedFiltersPanel({
  id,
  open,
  filter,
  activeCount,
  onChangeFilter,
}: AdvancedFiltersPanelProps) {
  const [tagQuery, setTagQuery] = useState("");

  const filteredTags = useMemo(() => {
    const q = tagQuery.trim().toLowerCase();
    if (!q) return SELECTABLE_TAGS;
    return SELECTABLE_TAGS.filter((t) => t.text.toLowerCase().includes(q));
  }, [tagQuery]);

  const toggleTag = (tagId: number) => {
    const exists = filter.tags.includes(tagId);
    const nextTags = exists
      ? filter.tags.filter((idVal) => idVal !== tagId)
      : [...filter.tags, tagId];
    onChangeFilter({ ...filter, tags: nextTags });
  };

  const resetAdvanced = () => {
    onChangeFilter({
      ...filter,
      status: "",
      type: "",
      tags: [],
      installed: "all",
      finished: "all",
    });
  };

  return (
    <div
      id={id}
      aria-hidden={!open}
      className={cn(
        "grid transition-[grid-template-rows,opacity] duration-200 ease-out",
        open
          ? "grid-rows-[1fr] opacity-100"
          : "pointer-events-none grid-rows-[0fr] opacity-0"
      )}
    >
      <div className="overflow-hidden">
        <div className="mx-auto max-w-7xl px-4 pb-3">
          <div className="max-h-[60vh] space-y-3 overflow-y-auto rounded-xl border border-border/80 bg-card/85 p-3.5 shadow-sm">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1.5">
                <Label
                  htmlFor="adv-filter-status"
                  className="text-xs font-medium text-muted-foreground"
                >
                  Status
                </Label>
                <Select
                  value={filter.status || ALL_VALUE}
                  onValueChange={(value) =>
                    onChangeFilter({
                      ...filter,
                      status: value === ALL_VALUE ? "" : value,
                    })
                  }
                >
                  <SelectTrigger
                    id="adv-filter-status"
                    className="w-full"
                    aria-label="Filter by status"
                  >
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_VALUE}>All Statuses</SelectItem>
                    {STATUS_LIST.map((s) => (
                      <SelectItem key={s.id} value={String(s.id)}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label
                  htmlFor="adv-filter-type"
                  className="text-xs font-medium text-muted-foreground"
                >
                  Engine Types
                </Label>
                <Select
                  value={filter.type || ALL_VALUE}
                  onValueChange={(value) =>
                    onChangeFilter({
                      ...filter,
                      type: value === ALL_VALUE ? "" : value,
                    })
                  }
                >
                  <SelectTrigger
                    id="adv-filter-type"
                    className="w-full"
                    aria-label="Filter by engine type"
                  >
                    <SelectValue placeholder="All Engine Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_VALUE}>All Engine Types</SelectItem>
                    {TYPE_LIST.map((t) => (
                      <SelectItem key={t.id} value={String(t.id)}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label
                  htmlFor="adv-filter-installed"
                  className="text-xs font-medium text-muted-foreground"
                >
                  Installed
                </Label>
                <Select
                  value={filter.installed}
                  onValueChange={(value) =>
                    onChangeFilter({
                      ...filter,
                      installed: value as InstalledFilterValue,
                    })
                  }
                >
                  <SelectTrigger
                    id="adv-filter-installed"
                    className="w-full"
                    aria-label="Filter by installed state"
                  >
                    <SelectValue placeholder="All Install States" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Install States</SelectItem>
                    <SelectItem value="installed">Installed</SelectItem>
                    <SelectItem value="up_to_date">Up to Date</SelectItem>
                    <SelectItem value="outdated">Outdated</SelectItem>
                    <SelectItem value="not_installed">Not Installed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label
                  htmlFor="adv-filter-finished"
                  className="text-xs font-medium text-muted-foreground"
                >
                  Finished
                </Label>
                <Select
                  value={filter.finished}
                  onValueChange={(value) =>
                    onChangeFilter({
                      ...filter,
                      finished: value as FinishedFilterValue,
                    })
                  }
                >
                  <SelectTrigger
                    id="adv-filter-finished"
                    className="w-full"
                    aria-label="Filter by finished state"
                  >
                    <SelectValue placeholder="All Completion States" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Completion States</SelectItem>
                    <SelectItem value="finished">Finished</SelectItem>
                    <SelectItem value="unfinished">Unfinished</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2 border-t border-border/70 pt-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">
                    Tags
                  </Label>
                  {filter.tags.map((tagId) => {
                    const meta = TAG_BY_ID.get(tagId);
                    if (!meta) return null;
                    return (
                      <Badge
                        key={tagId}
                        variant="default"
                        className="gap-1 rounded-md px-1.5 py-0.5 text-[11px]"
                      >
                        {meta.text}
                        <button
                          type="button"
                          onClick={() => toggleTag(tagId)}
                          aria-label={`Remove ${meta.text} tag filter`}
                          className="rounded-sm hover:bg-black/20"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    );
                  })}
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative w-44">
                    <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="text"
                      value={tagQuery}
                      onChange={(e) => setTagQuery(e.target.value)}
                      placeholder="Filter tags..."
                      className="h-7 bg-background/70 pl-7 text-xs"
                    />
                  </div>
                  {activeCount > 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      onClick={resetAdvanced}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <RotateCcw className="h-3 w-3" />
                      Reset
                    </Button>
                  )}
                </div>
              </div>

              <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto pr-1">
                {filteredTags.map((tag) => {
                  const selected = filter.tags.includes(tag.id);
                  return (
                    <Button
                      key={tag.id}
                      type="button"
                      size="xs"
                      variant={selected ? "default" : "outline"}
                      onClick={() => toggleTag(tag.id)}
                      className={cn(
                        "h-6 rounded-md px-2 text-[11px]",
                        !selected &&
                          "bg-background/60 text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {tag.text}
                    </Button>
                  );
                })}
                {filteredTags.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    No matching tags found.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
