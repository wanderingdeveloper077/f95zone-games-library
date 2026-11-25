import {
  ArrowDownUp,
  ChevronDown,
  Grid3x3,
  LayoutGrid,
  List,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { useState } from "react";
import { AdvancedFiltersPanel } from "@/components/filters/AdvancedFiltersPanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { countActiveAdvancedFilters } from "@/lib/gamePresentation";
import { cn } from "@/lib/utils";
import type { GamesFilterState } from "@/services/gamesService";
import type { LibraryViewMode } from "@/store/slices/gamesSlice";

interface FilterToolbarProps {
  filter: GamesFilterState;
  viewMode: LibraryViewMode;
  onChangeFilter: (next: GamesFilterState) => void;
  onChangeViewMode: (mode: LibraryViewMode) => void;
}

export function FilterToolbar({
  filter,
  viewMode,
  onChangeFilter,
  onChangeViewMode,
}: FilterToolbarProps) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const activeAdvancedCount = countActiveAdvancedFilters(filter);

  return (
    <section
      aria-label="Game library filters"
      className="sticky top-0 z-30 border-b border-border/80 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85"
    >
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2.5 px-4 py-2.5">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              value={filter.search}
              onChange={(e) =>
                onChangeFilter({ ...filter, search: e.target.value })
              }
              placeholder="Search title, developer, notes..."
              className="h-8 bg-card/80 pl-8 text-xs"
            />
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-expanded={advancedOpen}
            aria-controls="advanced-filters-panel"
            onClick={() => setAdvancedOpen((prev) => !prev)}
            className={cn(
              "gap-1.5",
              (advancedOpen || activeAdvancedCount > 0) &&
                "border-primary/60 bg-primary/10 text-foreground hover:bg-primary/15"
            )}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Advanced Filters
            {activeAdvancedCount > 0 && (
              <Badge
                variant="default"
                className="h-4 min-w-4 rounded-full px-1 text-[10px]"
              >
                {activeAdvancedCount}
              </Badge>
            )}
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 transition-transform duration-200",
                advancedOpen && "rotate-180"
              )}
            />
          </Button>

          <div className="inline-flex h-8 items-center gap-2 rounded-lg border border-input bg-card/80 px-2.5">
            <Checkbox
              id="filter-updates-only"
              checked={filter.updatesOnly}
              onCheckedChange={(checked) =>
                onChangeFilter({ ...filter, updatesOnly: checked === true })
              }
            />
            <Label
              htmlFor="filter-updates-only"
              className="cursor-pointer font-normal text-muted-foreground"
            >
              Updates Only
            </Label>
          </div>

          <div className="inline-flex h-8 items-center gap-2 rounded-lg border border-input bg-card/80 px-2.5">
            <Checkbox
              id="filter-show-archived"
              checked={filter.showArchived}
              onCheckedChange={(checked) =>
                onChangeFilter({ ...filter, showArchived: checked === true })
              }
            />
            <Label
              htmlFor="filter-show-archived"
              className="cursor-pointer font-normal text-muted-foreground"
            >
              Archived
            </Label>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Select
            value={filter.sort}
            onValueChange={(value) =>
              onChangeFilter({
                ...filter,
                sort: value as GamesFilterState["sort"],
              })
            }
          >
            <SelectTrigger className="w-[175px]" aria-label="Sort games">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="lastUpdated">Sort: Last Updated</SelectItem>
              <SelectItem value="addedAt">Sort: Date Added</SelectItem>
              <SelectItem value="name">Sort: Name</SelectItem>
              <SelectItem value="score">Sort: Forum Score</SelectItem>
              <SelectItem value="rating">Sort: Personal Rating</SelectItem>
            </SelectContent>
          </Select>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              onChangeFilter({
                ...filter,
                dir: filter.dir === "desc" ? "asc" : "desc",
              })
            }
            title="Toggle sort direction"
          >
            <ArrowDownUp className="h-3.5 w-3.5" />
            {filter.dir.toUpperCase()}
          </Button>

          <div className="flex overflow-hidden rounded-lg border border-border bg-card">
            <Button
              type="button"
              variant={viewMode === "grid" ? "default" : "ghost"}
              size="icon"
              onClick={() => onChangeViewMode("grid")}
              className="rounded-none"
              title="Grid View"
              aria-label="Grid View"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              variant={viewMode === "small-grid" ? "default" : "ghost"}
              size="icon"
              onClick={() => onChangeViewMode("small-grid")}
              className="rounded-none"
              title="Small Grid View"
              aria-label="Small Grid View"
            >
              <Grid3x3 className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              variant={viewMode === "list" ? "default" : "ghost"}
              size="icon"
              onClick={() => onChangeViewMode("list")}
              className="rounded-none"
              title="List View"
              aria-label="List View"
            >
              <List className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      <AdvancedFiltersPanel
        id="advanced-filters-panel"
        open={advancedOpen}
        filter={filter}
        activeCount={activeAdvancedCount}
        onChangeFilter={onChangeFilter}
      />
    </section>
  );
}
