import type { TagHighlightId } from "@game-library/shared";
import type * as React from "react";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import {
  DEFAULT_TAG_BADGE_CLASS,
  getTagHighlightPresentation,
} from "@/lib/gamePresentation";
import { cn } from "@/lib/utils";

export interface TagBadgeProps extends BadgeProps {
  highlight?: TagHighlightId;
  tone?: "badge" | "pill";
  trailingAction?: React.ReactNode;
}

export function TagBadge({
  highlight,
  tone = "badge",
  trailingAction,
  className,
  variant = "outline",
  children,
  ...props
}: TagBadgeProps) {
  const presentation = getTagHighlightPresentation(highlight);
  const toneClass = presentation
    ? tone === "pill"
      ? presentation.pillClass
      : presentation.badgeClass
    : DEFAULT_TAG_BADGE_CLASS;

  return (
    <Badge
      variant={variant}
      className={cn(
        toneClass,
        trailingAction ? "gap-1 pr-1" : undefined,
        className
      )}
      {...props}
    >
      {children}
      {trailingAction}
    </Badge>
  );
}
