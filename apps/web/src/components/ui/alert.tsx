import { type VariantProps, cva } from "class-variance-authority";
import type * as React from "react";
import { cn } from "@/lib/utils";

const alertVariants = cva(
  "relative flex w-full items-start gap-2.5 rounded-xl border px-3.5 py-2.5 text-xs",
  {
    variants: {
      variant: {
        default: "border-border bg-card text-foreground",
        destructive:
          "border-rose-600/50 bg-rose-500/10 text-rose-800 [&>svg]:text-rose-600 dark:border-rose-800/70 dark:bg-rose-950/40 dark:text-rose-200 dark:[&>svg]:text-rose-400",
        warning:
          "border-amber-600/50 bg-amber-500/10 text-amber-900 [&>svg]:text-amber-600 dark:border-amber-700/60 dark:bg-amber-950/30 dark:text-amber-200 dark:[&>svg]:text-amber-400",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return (
    <div
      data-slot="alert"
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  );
}

export function AlertTitle({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-title"
      className={cn("font-semibold tracking-tight", className)}
      {...props}
    />
  );
}

export function AlertDescription({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn("flex-1 text-xs leading-relaxed", className)}
      {...props}
    />
  );
}
