import {
  type ExtensionBootstrapResponse,
  TagHighlight,
} from "@game-library/shared";
import { browser, defineContentScript } from "#imports";
import type {
  BackgroundPushMessage,
  ExtensionActionResult,
  ExtensionRequest,
} from "../lib/messaging";

const BADGE_CLASS = "gl-library-badge";
const TOAST_ID = "gl-library-toast";

const HIGHLIGHT_STYLES: Record<
  number,
  { color: string; backgroundColor: string; border: string }
> = {
  [TagHighlight.Positive]: {
    color: "#ffffff",
    backgroundColor: "#006600",
    border: "1px solid rgba(255,255,255,0.35)",
  },
  [TagHighlight.Negative]: {
    color: "#ffffff",
    backgroundColor: "#990000",
    border: "1px solid rgba(255,255,255,0.35)",
  },
  [TagHighlight.Critical]: {
    color: "#ffffff",
    backgroundColor: "#000000",
    border: "1px solid rgba(255,255,255,0.35)",
  },
};

function extractThreadId(url: string): number | null {
  const match = /threads\/(?:[^./?\s#]*\.)?(\d+)/.exec(url);
  if (!match?.[1]) return null;
  const id = Number.parseInt(match[1], 10);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function isValidHrefElem(
  elem: HTMLAnchorElement,
  elemId: number,
  pageId: number | null
): boolean {
  if (/reply\?.*$/.test(elem.href)) return false;
  if (/page-.*$/.test(elem.href)) return false;
  if (/more\?k=[0-9a-f]+$/.test(elem.href)) return false;
  if (/\/reviews\/(?:$|\?)/.test(elem.href)) return false;

  const parent = elem.parentElement;
  if (
    parent &&
    (parent.classList.contains("pageNav") ||
      parent.classList.contains("pageNav-page"))
  ) {
    return false;
  }

  const ul = elem.closest("ul");
  if (ul?.classList.contains("message-attribution-opposite")) return false;
  if (elem.closest(".message-threadStarterPost") && elemId === pageId) {
    return false;
  }
  if (
    elem.classList.contains("button") ||
    elem.classList.contains("tabs-tab") ||
    elem.classList.contains("u-concealed")
  ) {
    return false;
  }

  return true;
}

function showToast(message: string, level: "info" | "error"): void {
  let toast = document.getElementById(TOAST_ID);
  if (!toast) {
    toast = document.createElement("div");
    toast.id = TOAST_ID;
    toast.style.position = "fixed";
    toast.style.bottom = "20px";
    toast.style.right = "20px";
    toast.style.zIndex = "999999";
    toast.style.padding = "10px 14px";
    toast.style.borderRadius = "8px";
    toast.style.fontSize = "13px";
    toast.style.fontWeight = "600";
    toast.style.color = "#ffffff";
    toast.style.boxShadow = "0 6px 24px rgba(0,0,0,0.45)";
    toast.style.maxWidth = "340px";
    document.body.appendChild(toast);
  }
  toast.style.backgroundColor = level === "error" ? "#991b1b" : "#065f46";
  toast.style.border =
    level === "error" ? "1px solid #f87171" : "1px solid #34d399";
  toast.textContent = message;
  toast.style.display = "block";
  setTimeout(() => {
    if (toast) toast.style.display = "none";
  }, 4000);
}

function createBadgeElement(
  game: ExtensionBootstrapResponse["games"][number],
  isTile: boolean,
  iconGlow: boolean
): HTMLSpanElement {
  const badge = document.createElement("span");
  badge.className = BADGE_CLASS;
  badge.textContent = game.hasUpdate ? "★ UPD" : "✓ LIB";

  let tooltip = `${game.name} — In your Game Library`;
  if (game.hasUpdate) tooltip += " (Update available)";
  if (game.notes) tooltip += `\n\nNOTES: ${game.notes}`;
  badge.setAttribute("title", tooltip);

  badge.style.display = "inline-flex";
  badge.style.alignItems = "center";
  badge.style.justifyContent = "center";
  badge.style.fontSize = isTile ? "11px" : "10px";
  badge.style.fontWeight = "700";
  badge.style.lineHeight = "1";
  badge.style.padding = isTile ? "4px 6px" : "2px 5px";
  badge.style.borderRadius = "4px";
  badge.style.backgroundColor = "#1f2937";
  badge.style.color = game.badgeColor;
  badge.style.border = `1px solid ${game.badgeColor}`;
  badge.style.cursor = "pointer";
  badge.style.verticalAlign = "middle";

  if (isTile) {
    badge.style.position = "absolute";
    badge.style.zIndex = "50";
    badge.style.left = "6px";
    badge.style.top = "6px";
    if (iconGlow) {
      badge.style.boxShadow = `0 0 18px 4px ${game.badgeColor}99`;
    }
  } else {
    badge.style.marginRight = "6px";
  }

  badge.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    showToast(tooltip, "info");
  });

  return badge;
}

function highlightTagsInDom(
  data: ExtensionBootstrapResponse
): void {
  if (!data.settings.highlightTags) return;
  const map = data.settings.tagHighlights;

  const applyHighlight = (el: HTMLElement, tagText: string) => {
    const level = map[tagText];
    if (!level) return;
    const style = HIGHLIGHT_STYLES[level];
    if (!style) return;
    el.style.color = style.color;
    el.style.backgroundColor = style.backgroundColor;
    el.style.border = style.border;
  };

  document
    .querySelectorAll<HTMLElement>("div.resource-tile-hover div.resource-tile_tags span")
    .forEach((span) => applyHighlight(span, span.textContent?.trim() ?? ""));

  document
    .querySelectorAll<HTMLElement>("a.tagItem")
    .forEach((link) => applyHighlight(link, link.textContent?.trim() ?? ""));
}

function renderLibraryBadges(data: ExtensionBootstrapResponse): void {
  document.querySelectorAll(`.${BADGE_CLASS}`).forEach((el) => el.remove());

  const byId = new Map(data.games.map((g) => [g.id, g]));
  const pageId = extractThreadId(document.location.href);

  document
    .querySelectorAll<HTMLAnchorElement>('a[href*="/threads/"]')
    .forEach((elem) => {
      const elemId = extractThreadId(elem.href);
      if (!elemId) return;
      const game = byId.get(elemId);
      if (!game) return;

      const isImage =
        elem.classList.contains("resource-tile_link") ||
        Boolean(elem.parentElement?.parentElement?.classList.contains("es-slides"));

      if (!isImage && !isValidHrefElem(elem, elemId, pageId)) return;

      const badge = createBadgeElement(game, isImage, data.settings.iconGlow);

      if (!isImage && elem.children.length > 0) {
        const whitespaces = elem.querySelectorAll("span.label-append");
        if (whitespaces.length > 0) {
          const last = whitespaces[whitespaces.length - 1]!;
          last.insertAdjacentElement("afterend", badge);
        } else if (
          elem.classList.contains("link--internal") &&
          !elem.querySelector("img[data-src]")
        ) {
          elem.insertAdjacentElement("beforebegin", badge);
        }
      } else if (elem.classList.contains("resource-tile_link")) {
        const thumb = elem.querySelector("div.resource-tile_thumb");
        thumb?.insertAdjacentElement("beforebegin", badge);
      } else {
        elem.insertAdjacentElement("beforebegin", badge);
      }
    });

  if (pageId) {
    const game = byId.get(pageId);
    const title = document.querySelector(".p-title-value");
    if (game && title) {
      const badge = createBadgeElement(game, false, data.settings.iconGlow);
      title.insertBefore(badge, title.lastChild);
    }
  }

  highlightTagsInDom(data);
}

export default defineContentScript({
  matches: ["*://*.f95zone.to/*"],
  runAt: "document_idle",
  main() {
    let latestData: ExtensionBootstrapResponse | null = null;

    const applyLatest = () => {
      if (!latestData) return;
      renderLibraryBadges(latestData);
      document.querySelectorAll("div.resource-tile_body").forEach((tile) => {
        if ((tile as HTMLElement).dataset.glObserved) return;
        (tile as HTMLElement).dataset.glObserved = "1";
        const obs = new MutationObserver(() => {
          if (latestData) highlightTagsInDom(latestData);
        });
        obs.observe(tile, { attributes: true, subtree: true });
      });
    };

    const latestWrap = document.getElementById("latest-page_items-wrap");
    if (latestWrap) {
      const wrapObs = new MutationObserver(() => applyLatest());
      wrapObs.observe(latestWrap, { attributes: true, childList: true });
    }

    browser.runtime.onMessage.addListener((rawMsg) => {
      const msg = rawMsg as BackgroundPushMessage;
      if (msg.type === "LIBRARY_UPDATED") {
        latestData = msg.data;
        applyLatest();
      } else if (msg.type === "TOAST") {
        showToast(msg.message, msg.level);
      }
    });

    void browser.runtime
      .sendMessage({ type: "GET_PAGE_DATA" } satisfies ExtensionRequest)
      .then((res) => {
        const typed = res as ExtensionActionResult<ExtensionBootstrapResponse>;
        if (typed?.ok && typed.data) {
          latestData = typed.data;
          applyLatest();
        }
      })
      .catch(() => undefined);
  },
});
