import type { AccountStatusValue, IndexJob } from "@game-library/shared";
import { AlertTriangle, Loader2, X } from "lucide-react";
import { DismissibleAlert } from "@/components/DismissibleAlert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { getSessionStatusPresentation } from "@/lib/gamePresentation";

export interface IndexingBannerProps {
  activeJob: Pick<
    IndexJob,
    "id" | "kind" | "processedCount" | "totalCount"
  > | null;
  currentItemName: string | null;
  lastJobError: string | null;
  accountStatus: AccountStatusValue | undefined;
  onCancelJob: (jobId: string) => void;
  onOpenSettings: () => void;
}

export function IndexingBanner({
  activeJob,
  currentItemName,
  lastJobError,
  accountStatus,
  onCancelJob,
  onOpenSettings,
}: IndexingBannerProps) {
  const sessionPresentation = getSessionStatusPresentation(accountStatus);
  const warningText =
    sessionPresentation.bannerMessage ??
    (lastJobError ? `Last job reported an issue: ${lastJobError}` : null);

  if (!activeJob && !warningText) {
    return null;
  }

  const pct =
    activeJob && activeJob.totalCount > 0
      ? Math.min(
          100,
          Math.round((activeJob.processedCount / activeJob.totalCount) * 100)
        )
      : 0;

  return (
    <div className="mx-auto mt-3 flex max-w-7xl flex-col gap-2 px-4">
      {activeJob && (
        <Card className="bg-card/80 p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-medium text-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span>
                Indexing ({activeJob.kind.replace(/_/g, " ")}):{" "}
                {activeJob.processedCount}/{activeJob.totalCount}
                {currentItemName ? ` — ${currentItemName}` : ""}
              </span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={() => onCancelJob(activeJob.id)}
            >
              <X className="h-3.5 w-3.5" />
              Cancel
            </Button>
          </div>
          <Progress value={pct} className="mt-2 h-1.5" />
        </Card>
      )}

      {warningText && (
        <DismissibleAlert
          variant="warning"
          icon={<AlertTriangle className="h-4 w-4 shrink-0" />}
          action={
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={onOpenSettings}
              className="border-amber-600/50 bg-amber-500/20 text-amber-900 hover:bg-amber-500/30 dark:text-amber-200 dark:hover:text-amber-100"
            >
              Check Session
            </Button>
          }
        >
          {warningText}
        </DismissibleAlert>
      )}
    </div>
  );
}
