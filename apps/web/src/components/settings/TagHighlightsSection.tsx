import {
  type AppSettings,
  TAGS,
  TagHighlight,
  type TagHighlightId,
} from "@game-library/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { X } from "lucide-react";
import { useForm } from "react-hook-form";
import { TagBadge } from "@/components/TagBadge";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  type TagHighlightFormValues,
  tagHighlightFormSchema,
} from "@/schemas/forms";

const SELECTABLE_TAGS = TAGS.filter((t) => t.slug !== "unknown");

export interface TagHighlightsSectionProps {
  tagHighlights: AppSettings["tagHighlights"];
  saving: boolean;
  onAddHighlight: (values: TagHighlightFormValues) => Promise<boolean>;
  onRemoveHighlight: (tagName: string) => void;
}

export function TagHighlightsSection({
  tagHighlights,
  saving,
  onAddHighlight,
  onRemoveHighlight,
}: TagHighlightsSectionProps) {
  const form = useForm<TagHighlightFormValues>({
    resolver: zodResolver(tagHighlightFormSchema),
    defaultValues: {
      tagText: "3dcg",
      level: TagHighlight.Positive,
    },
  });

  return (
    <div className="space-y-2.5">
      <div className="font-medium text-foreground">Tag Highlights</div>

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit((values) => {
            void onAddHighlight(values);
          })}
          noValidate
          className="space-y-2"
        >
          <div className="flex items-start gap-2">
            <FormField
              control={form.control}
              name="tagText"
              render={({ field }) => (
                <FormItem className="flex-1">
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full" aria-label="Select tag">
                        <SelectValue placeholder="Choose tag" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {SELECTABLE_TAGS.map((t) => (
                        <SelectItem key={t.id} value={t.text}>
                          {t.text}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="level"
              render={({ field }) => (
                <FormItem>
                  <Select
                    value={String(field.value)}
                    onValueChange={(v) =>
                      field.onChange(Number(v) as TagHighlightId)
                    }
                  >
                    <FormControl>
                      <SelectTrigger
                        className="w-24"
                        aria-label="Highlight level"
                      >
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={String(TagHighlight.Positive)}>
                        Positive
                      </SelectItem>
                      <SelectItem value={String(TagHighlight.Negative)}>
                        Negative
                      </SelectItem>
                      <SelectItem value={String(TagHighlight.Critical)}>
                        Critical
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              type="submit"
              size="sm"
              className="h-8"
              disabled={saving || form.formState.isSubmitting}
            >
              Add
            </Button>
          </div>
        </form>
      </Form>

      <div className="flex flex-wrap gap-1.5">
        {Object.entries(tagHighlights).map(([name, level]) => (
          <TagBadge
            key={name}
            tone="pill"
            highlight={level}
            trailingAction={
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove ${name} highlight`}
                title="Remove highlight"
                onClick={() => onRemoveHighlight(name)}
                className="h-4 w-4 rounded-sm text-white/80 hover:bg-white/20 hover:text-white"
              >
                <X className="h-2.5 w-2.5" />
              </Button>
            }
          >
            {name}
          </TagBadge>
        ))}
      </div>
    </div>
  );
}
