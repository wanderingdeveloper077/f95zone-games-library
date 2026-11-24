import type { AccountStatus } from "@game-library/shared";
import { BookmarkPlus, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSessionStatusPresentation } from "@/lib/gamePresentation";

export interface SessionSectionProps {
  account: AccountStatus | undefined;
  verifying: boolean;
  importing: boolean;
  onVerify: () => void;
  onImportList: (source: "watched" | "bookmarks") => void;
  onClear: () => void;
}

export function SessionSection({
  account,
  verifying,
  importing,
  onVerify,
  onImportList,
  onClear,
}: SessionSectionProps) {
  const statusPresentation = getSessionStatusPresentation(account?.status);

  return (
    <Card className="bg-card/40">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-xs">
          <ShieldCheck className="h-4 w-4 text-emerald-400" />
          F95zone Encrypted Session
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-3 pt-1">
        <div className="space-y-1.5 text-neutral-300">
          <div className="flex items-center gap-2">
            <span>Status:</span>
            <Badge
              variant={statusPresentation.badgeVariant}
              className="uppercase"
            >
              {account?.status ?? "unconfigured"}
            </Badge>
          </div>
          <div className="text-muted-foreground">
            Cookies stored: {account?.cookieCount ?? 0} |{" "}
            <code>xf_user</code>: {account?.hasXfUser ? "Yes" : "No"} |{" "}
            <code>cf_clearance</code>:{" "}
            {account?.hasCfClearance ? "Yes" : "No"}
          </div>
          {account?.lastVerifiedAtMs && (
            <div className="text-muted-foreground">
              Last verified:{" "}
              {new Date(account.lastVerifiedAtMs).toLocaleString()}
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={onVerify}
            disabled={verifying}
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${verifying ? "animate-spin" : ""}`}
            />
            Verify Session
          </Button>
          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={() => onImportList("watched")}
            disabled={!account?.hasXfUser || importing}
          >
            <BookmarkPlus className="h-3.5 w-3.5" />
            Import Watched
          </Button>
          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={() => onImportList("bookmarks")}
            disabled={!account?.hasXfUser || importing}
          >
            <BookmarkPlus className="h-3.5 w-3.5" />
            Import Bookmarks
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="xs"
            onClick={onClear}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Clear
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
