import { TagHighlight, extractThreadMatches } from "@game-library/shared";
import { z } from "zod";

export const addF95UrlsFormSchema = z.object({
  urlsText: z
    .string()
    .trim()
    .min(1, "Paste at least one F95zone thread URL.")
    .refine(
      (val) => extractThreadMatches(val).length > 0,
      "No valid F95zone thread URLs detected (e.g. https://f95zone.to/threads/game.12345/)."
    ),
});
export type AddF95UrlsFormValues = z.infer<typeof addF95UrlsFormSchema>;

export const addCustomGameFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Game name is required.")
    .max(200, "Max 200 characters."),
  version: z
    .string()
    .trim()
    .min(1, "Version is required.")
    .max(100, "Max 100 characters."),
  developer: z.string().trim().max(200, "Max 200 characters."),
  url: z
    .string()
    .trim()
    .max(500, "Max 500 characters.")
    .refine(
      (val) => val === "" || /^https?:\/\/.+/i.test(val),
      "Enter a valid http:// or https:// URL, or leave blank."
    ),
});
export type AddCustomGameFormValues = z.infer<typeof addCustomGameFormSchema>;

export const gameNotesFormSchema = z.object({
  notes: z.string().max(20000, "Notes must be 20,000 characters or fewer."),
});
export type GameNotesFormValues = z.infer<typeof gameNotesFormSchema>;

export const addExecutableFormSchema = z.object({
  executable: z
    .string()
    .trim()
    .min(1, "Enter an executable path, folder, or URI.")
    .max(1000, "Max 1000 characters."),
});
export type AddExecutableFormValues = z.infer<typeof addExecutableFormSchema>;

export const indexerSettingsFormSchema = z.object({
  useCacheApiFallback: z.boolean(),
  extIconGlow: z.boolean(),
  extHighlightTags: z.boolean(),
  scrapeDelayMs: z
    .number({ error: "Enter a valid delay in milliseconds." })
    .int("Scrape delay must be a whole number.")
    .min(250, "Minimum delay is 250 ms.")
    .max(10000, "Maximum delay is 10,000 ms."),
});
export type IndexerSettingsFormValues = z.infer<
  typeof indexerSettingsFormSchema
>;

export const tagHighlightFormSchema = z.object({
  tagText: z.string().min(1, "Select a tag to highlight."),
  level: z.union([
    z.literal(TagHighlight.Positive),
    z.literal(TagHighlight.Negative),
    z.literal(TagHighlight.Critical),
  ]),
});
export type TagHighlightFormValues = z.infer<typeof tagHighlightFormSchema>;
