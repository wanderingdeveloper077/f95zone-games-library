import type { AppSettings } from "@game-library/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  type IndexerSettingsFormValues,
  indexerSettingsFormSchema,
} from "@/schemas/forms";

export type IndexerPreferences = Pick<
  AppSettings,
  | "useCacheApiFallback"
  | "downloadGalleryImages"
  | "sfwMode"
  | "extIconGlow"
  | "extHighlightTags"
  | "scrapeDelayMs"
>;

export interface IndexerSettingsFormProps {
  preferences: IndexerPreferences;
  saving: boolean;
  onSave: (values: IndexerSettingsFormValues) => Promise<boolean>;
}

export function IndexerSettingsForm({
  preferences,
  saving,
  onSave,
}: IndexerSettingsFormProps) {
  const form = useForm<IndexerSettingsFormValues>({
    resolver: zodResolver(indexerSettingsFormSchema),
    defaultValues: preferences,
  });

  const {
    useCacheApiFallback,
    downloadGalleryImages,
    sfwMode,
    extIconGlow,
    extHighlightTags,
    scrapeDelayMs,
  } = preferences;

  useEffect(() => {
    form.reset({
      useCacheApiFallback,
      downloadGalleryImages,
      sfwMode,
      extIconGlow,
      extHighlightTags,
      scrapeDelayMs,
    });
  }, [
    useCacheApiFallback,
    downloadGalleryImages,
    sfwMode,
    extIconGlow,
    extHighlightTags,
    scrapeDelayMs,
    form,
  ]);

  const handleSubmit = async (values: IndexerSettingsFormValues) => {
    const ok = await onSave(values);
    if (ok) {
      form.reset(values);
    }
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(handleSubmit)}
        noValidate
        className="space-y-3"
      >
        <FormField
          control={form.control}
          name="useCacheApiFallback"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/40 px-3 py-2">
              <FormLabel className="cursor-pointer font-normal text-neutral-300">
                Fallback to Cache API on Cloudflare block
              </FormLabel>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="downloadGalleryImages"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/40 px-3 py-2">
              <FormLabel className="cursor-pointer font-normal text-neutral-300">
                Download gallery images on refresh
              </FormLabel>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="sfwMode"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/40 px-3 py-2">
              <FormLabel className="cursor-pointer font-normal text-neutral-300">
                SFW mode (blur covers and gallery images)
              </FormLabel>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="extIconGlow"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/40 px-3 py-2">
              <FormLabel className="cursor-pointer font-normal text-neutral-300">
                Extension icon glow on forum tiles
              </FormLabel>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="extHighlightTags"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/40 px-3 py-2">
              <FormLabel className="cursor-pointer font-normal text-neutral-300">
                Highlight tags in UI and extension
              </FormLabel>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="scrapeDelayMs"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-center justify-between gap-2">
                <FormLabel className="font-normal text-neutral-300">
                  Scrape delay (ms)
                </FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={250}
                    max={10000}
                    step={250}
                    value={Number.isNaN(field.value) ? "" : field.value}
                    onChange={(e) =>
                      field.onChange(
                        e.target.value === ""
                          ? Number.NaN
                          : e.target.valueAsNumber
                      )
                    }
                    className="h-8 w-28 text-right text-xs"
                  />
                </FormControl>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button
          type="submit"
          size="sm"
          className="w-full"
          disabled={
            saving || form.formState.isSubmitting || !form.formState.isDirty
          }
        >
          {saving ? "Saving Settings..." : "Save Settings"}
        </Button>
      </form>
    </Form>
  );
}
