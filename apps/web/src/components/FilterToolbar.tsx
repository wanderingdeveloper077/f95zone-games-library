import { STATUS_LIST, TYPE_LIST } from "@game-library/shared";
import { ArrowDownUp, LayoutGrid, List, Search } from "lucide-react";
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
import type { GamesFilterState } from "@/services/gamesService";

interface FilterToolbarProps {
  filter: GamesFilterState;
  viewMode: "grid" | "list";
  onChangeFilter: (next: GamesFilterState) => void;
  onChangeViewMode: (mode: "grid" | "list") => void;
}

const ALL_FILTER_VALUE = "__all__";

export function FilterToolbar({
  filter,
  viewMode,
  onChangeFilter,
  onChangeViewMode,
}: FilterToolbarProps) {
  return (
    <div className="mx-auto mt-4 flex max-w-7xl flex-wrap items-center justify-between gap-2.5 px-4">
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

        <Select
          value={filter.status || ALL_FILTER_VALUE}
          onValueChange={(value) =>
            onChangeFilter({
              ...filter,
              status: value === ALL_FILTER_VALUE ? "" : value,
            })
          }
        >
          <SelectTrigger className="w-[150px]" aria-label="Filter by status">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_FILTER_VALUE}>All Statuses</SelectItem>
            {STATUS_LIST.map((s) => (
              <SelectItem key={s.id} value={String(s.id)}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filter.type || ALL_FILTER_VALUE}
          onValueChange={(value) =>
            onChangeFilter({
              ...filter,
              type: value === ALL_FILTER_VALUE ? "" : value,
            })
          }
        >
          <SelectTrigger
            className="w-[175px]"
            aria-label="Filter by engine or type"
          >
            <SelectValue placeholder="All Engines / Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_FILTER_VALUE}>All Engines / Types</SelectItem>
            {TYPE_LIST.map((t) => (
              <SelectItem key={t.id} value={String(t.id)}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

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
  );
}
