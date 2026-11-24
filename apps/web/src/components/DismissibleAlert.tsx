import { X } from "lucide-react";
import type * as React from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface DismissibleAlertProps
  extends React.ComponentProps<typeof Alert> {
  icon?: React.ReactNode;
  action?: React.ReactNode;
  onDismiss?: () => void;
  dismissLabel?: string;
}

export function DismissibleAlert({
  icon,
  action,
  onDismiss,
  dismissLabel = "Dismiss alert",
  children,
  className,
  ...props
}: DismissibleAlertProps) {
  return (
    <Alert
      className={cn("items-center justify-between gap-2.5", className)}
      {...props}
    >
      {icon}
      <AlertDescription>{children}</AlertDescription>
      {action}
      {onDismiss && (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={dismissLabel}
          onClick={onDismiss}
          className="h-6 w-6 shrink-0 opacity-80 hover:opacity-100"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      )}
    </Alert>
  );
}
