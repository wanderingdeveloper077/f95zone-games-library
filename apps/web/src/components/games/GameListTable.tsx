import {
  type GameSummary,
  STATUS_META,
  type StatusId,
  TYPE_META,
  type TypeId,
} from "@game-library/shared";
import { Play } from "lucide-react";
import { GameStateActions } from "@/components/games/GameStateActions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatUnixDate, getStatusTextColor } from "@/lib/gamePresentation";
import { cn } from "@/lib/utils";

export interface GameListTableProps {
  games: GameSummary[];
  launchingGameId?: number | null;
  onSelectGame: (id: number) => void;
  onPlayGame: (game: GameSummary) => void;
  onToggleInstalled: (game: GameSummary) => void;
  onToggleFinished: (game: GameSummary) => void;
}

export function GameListTable({
  games,
  launchingGameId,
  onSelectGame,
  onPlayGame,
  onToggleInstalled,
  onToggleFinished,
}: GameListTableProps) {
  return (
    <Card className="overflow-hidden bg-card/50">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Game</TableHead>
            <TableHead>Engine</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Version</TableHead>
            <TableHead>Updated</TableHead>
            <TableHead>Score</TableHead>
            <TableHead className="text-right">State</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {games.map((g) => {
            const typeMeta = TYPE_META[g.type as TypeId];
            const statusMeta = STATUS_META[g.status as StatusId];
            const hasExecutable = (g.executables?.length ?? 0) > 0;

            return (
              <TableRow
                key={g.id}
                onClick={() => onSelectGame(g.id)}
                className="cursor-pointer"
              >
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">{g.name}</span>
                    {g.hasUpdate && (
                      <Badge
                        variant="warning"
                        className="px-1.5 py-0 text-[10px] font-semibold"
                      >
                        Update
                      </Badge>
                    )}
                  </div>
                  {g.developer && (
                    <div className="text-[11px] text-muted-foreground">
                      {g.developer}
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  <Badge
                    className="rounded px-1.5 py-0.5 text-[11px] font-medium text-white"
                    style={{ backgroundColor: typeMeta?.color ?? "#444" }}
                  >
                    {typeMeta?.label ?? "Misc"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <span style={{ color: getStatusTextColor(g.status) }}>
                    {statusMeta?.label ?? "Unknown"}
                  </span>
                </TableCell>
                <TableCell className="font-mono text-foreground">
                  {g.version}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatUnixDate(g.lastUpdatedTsSec)}
                </TableCell>
                <TableCell className="text-foreground">
                  {g.score > 0 ? `${g.score.toFixed(1)} (${g.votes})` : "—"}
                </TableCell>
                <TableCell
                  className="text-right"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="inline-flex items-center gap-1">
                    <Button
                      type="button"
                      size="xs"
                      variant={hasExecutable ? "default" : "secondary"}
                      disabled={launchingGameId === g.id}
                      onClick={() => onPlayGame(g)}
                      title={
                        hasExecutable
                          ? "Play game"
                          : "Add a game executable in details to play"
                      }
                      className={cn(
                        hasExecutable &&
                          "bg-emerald-600/90 text-white hover:bg-emerald-500"
                      )}
                    >
                      <Play className="h-3 w-3" />
                      Play
                    </Button>
                    <GameStateActions
                      game={g}
                      layout="compact"
                      onToggleInstalled={() => onToggleInstalled(g)}
                      onToggleFinished={() => onToggleFinished(g)}
                    />
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
}
