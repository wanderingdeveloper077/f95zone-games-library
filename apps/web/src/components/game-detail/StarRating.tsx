import { Star } from "lucide-react";
import type * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface StarRatingProps
  extends Omit<React.ComponentProps<"div">, "onChange"> {
  value: number;
  max?: number;
  label?: string;
  onChange: (next: number) => void;
}

export function StarRating({
  value,
  max = 5,
  label = "My Rating:",
  onChange,
  className,
  ...props
}: StarRatingProps) {
  return (
    <div
      className={cn("flex flex-wrap items-center gap-1", className)}
      {...props}
    >
      {label && (
        <span className="mr-1 text-xs text-muted-foreground">{label}</span>
      )}
      {Array.from({ length: max }, (_, idx) => idx + 1).map((star) => (
        <Button
          key={star}
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Rate ${star} star${star > 1 ? "s" : ""}`}
          onClick={() => onChange(value === star ? 0 : star)}
          className="h-6 w-6"
        >
          <Star
            className={cn(
              "h-4 w-4",
              star <= value
                ? "fill-amber-400 text-amber-400"
                : "text-muted-foreground/50 hover:text-muted-foreground"
            )}
          />
        </Button>
      ))}
    </div>
  );
}
