import type { PairingStatus } from "@game-library/shared";
import { Check, Copy, KeyRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useClipboardCopy } from "@/hooks/useClipboardCopy";
import { useCountdown } from "@/hooks/useCountdown";

export interface PairingSectionProps {
  pairing: PairingStatus | null;
  loading: boolean;
  onGenerateCode: () => void;
  onRotateToken: () => void;
}

export function PairingSection({
  pairing,
  loading,
  onGenerateCode,
  onRotateToken,
}: PairingSectionProps) {
  const activeCode = pairing?.activeCode ?? null;
  const remainingSec = useCountdown(
    activeCode?.expiresAtMs,
    Boolean(activeCode)
  );
  const { copied, copyText } = useClipboardCopy();

  return (
    <Card className="bg-card/40">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-xs">
          <KeyRound className="h-4 w-4 text-primary" />
          Browser Extension Pairing
        </CardTitle>
        <CardDescription>
          Generate a 6-character pairing code (valid 120s) and enter it in the
          browser extension popup, or copy the raw Pairing Token.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3 pt-1">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            onClick={onGenerateCode}
            disabled={loading}
          >
            Generate Pairing Code
          </Button>
          {activeCode && remainingSec > 0 && (
            <Badge
              variant="outline"
              className="gap-2 border-primary/40 bg-rose-950/30 px-3 py-1.5 text-rose-200"
            >
              <span className="font-mono text-sm font-bold tracking-widest">
                {activeCode.code}
              </span>
              <span className="text-[11px] text-rose-300">
                {remainingSec}s
              </span>
            </Badge>
          )}
        </div>

        {pairing && (
          <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 py-2">
            <span className="truncate font-mono text-[11px] text-muted-foreground">
              Token: {pairing.tokenPreview}
            </span>
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="secondary"
                size="xs"
                onClick={() => void copyText(pairing.pairingToken)}
              >
                {copied ? (
                  <Check className="h-3 w-3 text-emerald-400" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
                {copied ? "Copied" : "Copy"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="xs"
                onClick={onRotateToken}
                disabled={loading}
              >
                Rotate
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
