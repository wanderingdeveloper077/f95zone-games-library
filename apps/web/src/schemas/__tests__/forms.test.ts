import type { AppSettings } from "@game-library/shared";
import { TagHighlight } from "@game-library/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  addCustomGameFormSchema,
  addExecutableFormSchema,
  addF95UrlsFormSchema,
  gameNotesFormSchema,
  indexerSettingsFormSchema,
  tagHighlightFormSchema,
} from "@/schemas/forms";
import { ApiClientError } from "@/services/api";
import * as systemService from "@/services/systemService";
import { setPreviewTheme, updateSettingsThunk } from "@/store/slices/systemSlice";
import { createAppStore } from "@/store/store";

vi.mock("@/services/systemService", async () => {
  const actual = await vi.importActual<typeof import("@/services/systemService")>(
    "@/services/systemService"
  );
  return {
    ...actual,
    updateSettings: vi.fn(),
  };
});

describe("Frontend Zod form schemas", () => {
  it("validates addF95UrlsFormSchema for valid and invalid inputs", () => {
    expect(
      addF95UrlsFormSchema.safeParse({
        urlsText: "https://f95zone.to/threads/example-game.123456/",
      }).success
    ).toBe(true);

    const emptyRes = addF95UrlsFormSchema.safeParse({ urlsText: "   " });
    expect(emptyRes.success).toBe(false);
    if (!emptyRes.success) {
      expect(emptyRes.error.issues[0]?.message).toBe(
        "Paste at least one F95zone thread URL."
      );
    }

    const badUrlRes = addF95UrlsFormSchema.safeParse({
      urlsText: "https://example.com/not-a-thread",
    });
    expect(badUrlRes.success).toBe(false);
    if (!badUrlRes.success) {
      expect(badUrlRes.error.issues[0]?.message).toContain(
        "No valid F95zone thread URLs detected"
      );
    }
  });

  it("validates addCustomGameFormSchema fields and optional http(s) URL", () => {
    expect(
      addCustomGameFormSchema.safeParse({
        name: "My Indie Game",
        version: "1.2",
        developer: "Studio",
        url: "",
      }).success
    ).toBe(true);

    expect(
      addCustomGameFormSchema.safeParse({
        name: "My Indie Game",
        version: "1.2",
        developer: "",
        url: "https://example.com/game",
      }).success
    ).toBe(true);

    const missingName = addCustomGameFormSchema.safeParse({
      name: "  ",
      version: "1.0",
      developer: "",
      url: "",
    });
    expect(missingName.success).toBe(false);
    if (!missingName.success) {
      expect(missingName.error.issues[0]?.message).toBe(
        "Game name is required."
      );
    }

    const badUrl = addCustomGameFormSchema.safeParse({
      name: "Game",
      version: "1.0",
      developer: "",
      url: "ftp://invalid.local",
    });
    expect(badUrl.success).toBe(false);
    if (!badUrl.success) {
      expect(badUrl.error.issues[0]?.message).toContain("valid http:// or https:// URL");
    }
  });

  it("validates gameNotesFormSchema max length", () => {
    expect(gameNotesFormSchema.safeParse({ notes: "" }).success).toBe(true);
    expect(
      gameNotesFormSchema.safeParse({ notes: "a".repeat(20001) }).success
    ).toBe(false);
  });

  it("validates indexerSettingsFormSchema bounds, theme options, and NaN handling", () => {
    expect(
      indexerSettingsFormSchema.safeParse({
        theme: "dark",
        useCacheApiFallback: true,
        downloadGalleryImages: true,
        sfwMode: false,
        extIconGlow: false,
        extHighlightTags: true,
        scrapeDelayMs: 1250,
      }).success
    ).toBe(true);

    expect(
      indexerSettingsFormSchema.safeParse({
        theme: "midnight",
        useCacheApiFallback: false,
        downloadGalleryImages: false,
        sfwMode: true,
        extIconGlow: false,
        extHighlightTags: false,
        scrapeDelayMs: 500,
      }).success
    ).toBe(true);

    expect(
      indexerSettingsFormSchema.safeParse({
        theme: "invalid-theme",
        useCacheApiFallback: true,
        downloadGalleryImages: true,
        sfwMode: false,
        extIconGlow: true,
        extHighlightTags: true,
        scrapeDelayMs: 1000,
      }).success
    ).toBe(false);

    const tooLow = indexerSettingsFormSchema.safeParse({
      theme: "light",
      useCacheApiFallback: true,
      downloadGalleryImages: true,
      sfwMode: false,
      extIconGlow: true,
      extHighlightTags: true,
      scrapeDelayMs: 100,
    });
    expect(tooLow.success).toBe(false);
    if (!tooLow.success) {
      expect(tooLow.error.issues[0]?.message).toBe("Minimum delay is 250 ms.");
    }

    const nanRes = indexerSettingsFormSchema.safeParse({
      theme: "system",
      useCacheApiFallback: true,
      downloadGalleryImages: true,
      sfwMode: false,
      extIconGlow: true,
      extHighlightTags: true,
      scrapeDelayMs: Number.NaN,
    });
    expect(nanRes.success).toBe(false);
  });

  it("validates tagHighlightFormSchema choices", () => {
    expect(
      tagHighlightFormSchema.safeParse({
        tagText: "3dcg",
        level: TagHighlight.Positive,
      }).success
    ).toBe(true);

    expect(
      tagHighlightFormSchema.safeParse({
        tagText: "",
        level: TagHighlight.Negative,
      }).success
    ).toBe(false);

    expect(
      tagHighlightFormSchema.safeParse({
        tagText: "3dcg",
        level: 99,
      }).success
    ).toBe(false);
  });

  it("validates addExecutableFormSchema trimmed paths and URIs", () => {
    expect(
      addExecutableFormSchema.safeParse({
        executable: "  C:\\Games\\MyGame\\game.exe  ",
      })
    ).toEqual({
      success: true,
      data: { executable: "C:\\Games\\MyGame\\game.exe" },
    });

    const emptyRes = addExecutableFormSchema.safeParse({ executable: "   " });
    expect(emptyRes.success).toBe(false);
    if (!emptyRes.success) {
      expect(emptyRes.error.issues[0]?.message).toBe(
        "Enter an executable path, folder, or URI."
      );
    }
  });
});

describe("systemSlice settingsSaving transitions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("tracks settingsSaving, theme preview, and theme persistence across updates", async () => {
    const store = createAppStore();
    store.dispatch(setPreviewTheme("catppuccin"));
    expect(store.getState().system.previewTheme).toBe("catppuccin");

    const updatedSettings: AppSettings = {
      useCacheApiFallback: true,
      cacheApiUrl: "http://127.0.0.1:57095",
      scrapeDelayMs: 1500,
      downloadGalleryImages: false,
      sfwMode: true,
      theme: "dracula",
      extIconGlow: false,
      extHighlightTags: true,
      tagHighlights: { "3dcg": TagHighlight.Positive },
    };

    vi.mocked(systemService.updateSettings).mockResolvedValueOnce(
      updatedSettings
    );
    const pendingPromise = store.dispatch(
      updateSettingsThunk({ scrapeDelayMs: 1500, sfwMode: true, theme: "dracula" })
    );
    expect(store.getState().system.settingsSaving).toBe(true);
    await pendingPromise;
    expect(store.getState().system.settingsSaving).toBe(false);
    expect(store.getState().system.settings).toEqual(updatedSettings);
    expect(store.getState().system.cachedSfwMode).toBe(true);
    expect(store.getState().system.cachedTheme).toBe("dracula");
    expect(store.getState().system.previewTheme).toBeNull();
    expect(store.getState().system.settingsError).toBeNull();

    vi.mocked(systemService.updateSettings).mockRejectedValueOnce(
      new ApiClientError({
        status: 400,
        code: "VALIDATION_ERROR",
        message: "Invalid settings patch",
      })
    );
    await store.dispatch(updateSettingsThunk({ scrapeDelayMs: 10 }));
    expect(store.getState().system.settingsSaving).toBe(false);
    expect(store.getState().system.settingsError).toBe("Invalid settings patch");
  });
});
