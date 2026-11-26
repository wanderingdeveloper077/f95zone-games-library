import { APP_THEMES, type AppSettings, type AppThemeId } from "@game-library/shared";
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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  type IndexerSettingsFormValues,
  indexerSettingsFormSchema,
} from "@/schemas/forms";

export type IndexerPreferences = Pick<
  AppSettings,
  | "theme"
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
  onPreviewTheme?: (theme: AppThemeId) => void;
  onSave: (values: IndexerSettingsFormValues) => Promise<boolean>;
}

const MODE_THEMES = APP_THEMES.filter((item) => item.group === "mode");
const PALETTE_THEMES = APP_THEMES.filter((item) => item.group === "palette");

export function IndexerSettingsForm({
  preferences,
  saving,
  onPreviewTheme,
  onSave,
}: IndexerSettingsFormProps) {
  const form = useForm<IndexerSettingsFormValues>({
    resolver: zodResolver(indexerSettingsFormSchema),
    defaultValues: preferences,
  });

  const {
    theme,
    useCacheApiFallback,
    downloadGalleryImages,
    sfwMode,
    extIconGlow,
    extHighlightTags,
    scrapeDelayMs,
  } = preferences;

  useEffect(() => {
    form.reset({
      theme,
      useCacheApiFallback,
      downloadGalleryImages,
      sfwMode,
      extIconGlow,
      extHighlightTags,
      scrapeDelayMs,
    });
  }, [
    theme,
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
          name="theme"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/40 px-3 py-2">
              <FormLabel
                htmlFor="settings-theme-select"
                className="font-normal text-foreground"
              >
                Theme
              </FormLabel>
              <Select
                value={field.value}
                onValueChange={(value) => {
                  const next = value as AppThemeId;
                  field.onChange(next);
                  onPreviewTheme?.(next);
                }}
              >
                <FormControl>
                  <SelectTrigger
                    id="settings-theme-select"
                    className="w-44"
                    aria-label="Theme"
                  >
                    <SelectValue placeholder="Choose theme" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Appearance</SelectLabel>
                    {MODE_THEMES.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        <span className="inline-flex items-center gap-2">
                          <span
                            className="size-2.5 shrink-0 rounded-full border border-border"
                            style={{ backgroundColor: item.swatch }}
                            aria-hidden="true"
                          />
                          <span>{item.label}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectGroup>
                  <SelectSeparator />
                  <SelectGroup>
                    <SelectLabel>Color Palettes</SelectLabel>
                    {PALETTE_THEMES.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        <span className="inline-flex items-center gap-2">
                          <span
                            className="size-2.5 shrink-0 rounded-full border border-border"
                            style={{ backgroundColor: item.swatch }}
                            aria-hidden="true"
                          />
                          <span>{item.label}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="useCacheApiFallback"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/40 px-3 py-2">
              <FormLabel className="cursor-pointer font-normal text-foreground">
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
              <FormLabel className="cursor-pointer font-normal text-foreground">
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
              <FormLabel className="cursor-pointer font-normal text-foreground">
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
              <FormLabel className="cursor-pointer font-normal text-foreground">
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
              <FormLabel className="cursor-pointer font-normal text-foreground">
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
                <FormLabel className="font-normal text-foreground">
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
