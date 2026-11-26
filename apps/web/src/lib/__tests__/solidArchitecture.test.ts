import { type SseEvent, TagHighlight } from "@game-library/shared";
import { describe, expect, it, vi } from "vitest";
import {
  buildGalleryImageUrl,
  stepGalleryIndex,
} from "@/components/game-detail/GameGalleryTab";
import {
  countActiveAdvancedFilters,
  formatUnixDate,
  getGameInstallState,
  getNextFinishedVersion,
  getNextInstalledVersion,
  getSessionStatusPresentation,
  getSfwImageBlurClass,
  getTagHighlightPresentation,
} from "@/lib/gamePresentation";
import { createApiClient } from "@/services/api";
import {
  type EventSourceLike,
  subscribeToEvents,
} from "@/services/eventsService";

describe("gamePresentation utilities", () => {
  it("resolves session status presentation via lookup map and safe default", () => {
    expect(getSessionStatusPresentation(undefined)).toMatchObject({
      headerLabel: "Session: Not Paired",
      badgeVariant: "secondary",
      isWarning: false,
      bannerMessage: null,
    });
    expect(getSessionStatusPresentation("active")).toMatchObject({
      headerLabel: "Session: Active",
      badgeVariant: "success",
      isWarning: false,
    });
    expect(getSessionStatusPresentation("captcha_required")).toMatchObject({
      headerLabel: "Cloudflare Challenge",
      badgeVariant: "warning",
      isWarning: true,
    });
    expect(getSessionStatusPresentation("expired")).toMatchObject({
      headerLabel: "Session Expired",
      badgeVariant: "destructive",
      isWarning: true,
    });
  });

  it("resolves tag highlight presentation by level", () => {
    expect(getTagHighlightPresentation(undefined)).toBeNull();
    expect(getTagHighlightPresentation(TagHighlight.Positive)?.label).toBe(
      "Positive"
    );
    expect(getTagHighlightPresentation(TagHighlight.Negative)?.label).toBe(
      "Negative"
    );
    expect(getTagHighlightPresentation(TagHighlight.Critical)?.label).toBe(
      "Critical"
    );
  });

  it("computes install/finished state and next toggle versions cleanly", () => {
    expect(
      getGameInstallState({
        version: "1.0",
        installedVersion: "1.0",
        finishedVersion: "1.0",
      })
    ).toEqual({
      isInstalledCurrent: true,
      isInstalledOld: false,
      isFinishedCurrent: true,
    });

    expect(
      getGameInstallState({
        version: "2.0",
        installedVersion: "1.0",
        finishedVersion: "1.0",
      })
    ).toEqual({
      isInstalledCurrent: false,
      isInstalledOld: true,
      isFinishedCurrent: true,
    });

    expect(
      getNextInstalledVersion({ version: "2.0", installedVersion: "" })
    ).toBe("2.0");
    expect(
      getNextInstalledVersion({ version: "2.0", installedVersion: "2.0" })
    ).toBe("");
    expect(
      getNextFinishedVersion({
        version: "2.0",
        installedVersion: "1.5",
        finishedVersion: "",
      })
    ).toBe("1.5");
    expect(
      getNextFinishedVersion({
        version: "2.0",
        installedVersion: "1.5",
        finishedVersion: "1.5",
      })
    ).toBe("");
  });

  it("formats zero timestamps as em dash and valid seconds to a date string", () => {
    expect(formatUnixDate(0)).toBe("—");
    expect(formatUnixDate(1_700_000_000)).not.toBe("—");
  });

  it("counts active advanced filters across status, engine type, install/finish states, and tags", () => {
    expect(
      countActiveAdvancedFilters({
        status: "",
        type: "",
        installed: "all",
        finished: "all",
        tags: [],
      })
    ).toBe(0);

    expect(
      countActiveAdvancedFilters({
        status: "2",
        type: "14",
        installed: "outdated",
        finished: "unfinished",
        tags: [12, 45],
      })
    ).toBe(6);
  });

  it("returns blur classes only when SFW mode is enabled", () => {
    expect(getSfwImageBlurClass(false)).toBe("");
    expect(getSfwImageBlurClass(true)).toBe(
      "scale-110 blur-xl group-hover:scale-110"
    );
  });
});

describe("DIP abstractions in apiClient and eventsService", () => {
  it("injects X-Pairing-Token from abstract TokenProvider without storage coupling", async () => {
    let capturedHeaders: Record<string, unknown> = {};
    const clientWithToken = createApiClient({
      baseURL: "http://127.0.0.1:57095",
      getPairingToken: () => "secret-token-123",
    });

    clientWithToken.defaults.adapter = async (config) => {
      capturedHeaders = config.headers.toJSON();
      return {
        data: { ok: true },
        status: 200,
        statusText: "OK",
        headers: {},
        config,
      };
    };

    await clientWithToken.get("/api/games");
    expect(capturedHeaders["X-Pairing-Token"]).toBe("secret-token-123");

    const clientWithoutToken = createApiClient({
      baseURL: "http://127.0.0.1:57095",
      getPairingToken: () => null,
    });

    clientWithoutToken.defaults.adapter = async (config) => {
      capturedHeaders = config.headers.toJSON();
      return {
        data: { ok: true },
        status: 200,
        statusText: "OK",
        headers: {},
        config,
      };
    };

    await clientWithoutToken.get("/api/games");
    expect(capturedHeaders["X-Pairing-Token"]).toBeUndefined();
  });

  it("subscribes to SSE events and cleans up with injected EventSourceFactory", () => {
    const listeners = new Map<string, (ev: Event) => void>();
    const closeSpy = vi.fn();
    let createdUrl = "";

    const fakeSource: EventSourceLike = {
      addEventListener: (type, listener) => {
        listeners.set(type, listener);
      },
      close: closeSpy,
      onopen: null,
      onerror: null,
    };

    const received: SseEvent[] = [];
    const onOpen = vi.fn();
    const onError = vi.fn();

    const unsubscribe = subscribeToEvents(
      "/api/events",
      {
        onOpen,
        onError,
        onEvent: (event) => received.push(event),
      },
      (url) => {
        createdUrl = url;
        return fakeSource;
      }
    );

    expect(createdUrl).toBe("/api/events");

    fakeSource.onopen?.(new Event("open"));
    fakeSource.onerror?.(new Event("error"));
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledTimes(1);

    const connectedListener = listeners.get("connected");
    expect(connectedListener).toBeDefined();

    connectedListener?.(
      new MessageEvent("connected", {
        data: JSON.stringify({ type: "connected", serverTimeMs: 12345 }),
      })
    );

    // Malformed payload should be ignored without throwing
    connectedListener?.(new MessageEvent("connected", { data: "{bad json" }));

    expect(received).toEqual([{ type: "connected", serverTimeMs: 12345 }]);

    unsubscribe();
    expect(closeSpy).toHaveBeenCalledTimes(1);
  });
});

describe("GameGalleryTab helpers", () => {
  it("builds safe gallery image URLs and wraps lightbox indices cleanly", () => {
    expect(buildGalleryImageUrl(12345, "abc123.png")).toBe(
      "/covers/gallery/12345/abc123.png"
    );
    expect(stepGalleryIndex(0, -1, 4)).toBe(3);
    expect(stepGalleryIndex(3, 1, 4)).toBe(0);
    expect(stepGalleryIndex(1, 1, 4)).toBe(2);
    expect(stepGalleryIndex(0, 1, 0)).toBe(0);
  });
});
