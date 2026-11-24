import { Status, TAG_BY_SLUG, Type } from "@game-library/shared";
import { describe, expect, it } from "vitest";
import {
  classifyF95Error,
  normalizeAttachmentUrl,
  sanitizeLatestUpdatesQuery,
} from "../indexer/f95zone.js";
import {
  parseReviewsHtml,
  parseThreadHtml,
  parseWatchedPageHtml,
} from "../indexer/parser.js";

const SAMPLE_THREAD_HTML = `<!DOCTYPE html>
<html>
<head>
  <title>Ren'Py - My Awesome Game [v0.5.2] [DevStudio] | F95zone</title>
  <script type="application/ld+json">
    {"@context":"http://schema.org/","aggregateRating":{"ratingValue":"4.6","ratingCount":"312"}}
  </script>
</head>
<body>
  <div class="p-header-logo"><img alt="F95zone" src="/logo.png" /></div>
  <div class="p-body-header">
    <h1 class="p-title-value">
      <span class="p-title-prefix">Ren'Py</span>
      <span class="p-title-prefix">Completed</span>
      My Awesome Game [v0.5.2] [Patreon]
    </h1>
    <span class="js-tagList">
      <a href="/tags/3dcg/" class="tagItem">3dcg</a>
      <a href="/tags/romance/" class="tagItem">romance</a>
      <a href="/tags/brand-new-unknown-tag/" class="tagItem">brand-new-unknown-tag</a>
    </span>
  </div>
  <article class="message-threadStarterPost">
    <div class="message-attribution-main"><time data-timestamp="1700000000">Nov 2023</time></div>
    <article>
      <div class="bbWrapper">
        <div data-src="https://preview.f95zone.to/2025/01/cover.jpg?h=abc123"></div>
        <a class="js-lbImage" href="https://attachments.f95zone.to/2025/01/screen1.png?h=xyz">Screen 1</a>
        <div><b>Version</b>: 0.5.2</div>
        <div><b>Developer</b>: Studio Alpha - Patreon / Discord</div>
        <div><b>Thread Updated</b>: 2025/01/15</div>
        <div><b>Overview</b>:</div>
        <div>An intriguing visual novel adventure across floating islands.</div>
        <div><b>Changelog</b>:</div>
        <div class="bbCodeSpoiler">
          <button class="bbCodeSpoiler-button"><span><span>Spoiler</span></span></button>
          <div class="bbCodeSpoiler-content">Added Episode 5 and bug fixes.</div>
        </div>
        <div><b>Download</b>:</div>
        <div>Windows</div>
        <a class="link" href="https://mega.nz/file/abc123">MEGA</a>
        <a class="link" href="/dl/9999/1">Gofile</a>
      </div>
    </article>
  </article>
</body>
</html>`;

describe("F95zone parsers and classifiers", () => {
  it("parses thread metadata, strips title brackets & developer noise, and preserves raw download URLs", () => {
    const res = parseThreadHtml(SAMPLE_THREAD_HTML);
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.data.name).toBe("My Awesome Game");
    expect(res.data.threadVersion).toBe("0.5.2");
    expect(res.data.developer).toBe("Studio Alpha");
    expect(res.data.type).toBe(Type.RenPy);
    expect(res.data.status).toBe(Status.Completed);
    expect(res.data.score).toBe(4.6);
    expect(res.data.votes).toBe(312);
    expect(res.data.description).toContain("floating islands");
    expect(res.data.changelog).toContain("Added Episode 5");
    expect(res.data.changelog).not.toContain("Spoiler");
    expect(res.data.tags).toEqual([
      TAG_BY_SLUG.get("3dcg")!.id,
      TAG_BY_SLUG.get("romance")!.id,
    ]);
    expect(res.data.unknownTags).toEqual(["brand-new-unknown-tag"]);
    expect(res.data.imageUrl).toBe(
      "https://attachments.f95zone.to/2025/01/cover.jpg"
    );
    expect(res.data.previewsUrls).toEqual([
      "https://attachments.f95zone.to/2025/01/screen1.png",
    ]);
    expect(res.data.downloads).toEqual([
      {
        name: "Windows",
        mirrors: [
          { label: "MEGA", url: "https://mega.nz/file/abc123" },
          { label: "Gofile", url: "https://f95zone.to/dl/9999/1" },
        ],
      },
    ]);
  });

  it("maps READ ME prefix to Type.README and keeps non-empty developer on noise revert", () => {
    const html = `<html><body>
      <div class="p-body-header">
        <h1 class="p-title-value"><span class="p-title-prefix">READ ME</span> Notice Thread</h1>
      </div>
      <article class="message-threadStarterPost">
        <article><div class="bbWrapper"><div><b>Developer</b>: Patreon</div></div></article>
      </article>
    </body></html>`;

    const res = parseThreadHtml(html);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.type).toBe(Type.README);
    expect(res.data.developer).toBe("Patreon");
  });

  it("parses reviews and strips invisible unicode characters", () => {
    const html = `<html><body>
      <div class="p-body-pageContent">
        <div class="f95rv-banner-count">1,234 reviews</div>
        <div class="f95rv-cards">
          <div class="f95rv-card" data-author="Tester">
            <div class="f95rv-stars" aria-label="4.5 out of 5 stars"></div>
            <div class="bbWrapper"><div class="bbWrapper">Great\u200b game\u2063!</div></div>
            <div class="f95rv-vote">Helpful 12</div>
            <time class="u-dt" data-timestamp="1700001000"></time>
          </div>
        </div>
      </div>
    </body></html>`;

    const res = parseReviewsHtml(html);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.total).toBe(1234);
    expect(res.data.items).toEqual([
      {
        user: "Tester",
        score: 4.5,
        message: "Great game!",
        likes: 12,
        timestamp: 1700001000,
      },
    ]);
  });

  it("parses watched and bookmark HTML variants", () => {
    const watchedHtml = `<div class="p-body-pageContent">
      <div class="f95wg-row"><div class="f95wg-row-title"><a href="/threads/cool-game.12345/">Cool</a></div></div>
    </div>`;
    expect(parseWatchedPageHtml(watchedHtml, "new")).toEqual([
      { slug: "cool-game", id: 12345 },
    ]);
  });

  it("sanitizes Latest Updates search queries matching Python reference", () => {
    expect(
      sanitizeLatestUpdatesQuery("The Hero's Journey: Part 1 & 2 (Remastered)!")
    ).toBe("Hero Journey Part 1 2 Remaster");
    expect(sanitizeLatestUpdatesQuery("A Tale of the Two Cities")).toBe(
      "Tale Two Cities"
    );
  });

  it("normalizes attachment preview URLs", () => {
    expect(
      normalizeAttachmentUrl("https://preview.f95zone.to/a/b.png?h=secret")
    ).toBe("https://attachments.f95zone.to/a/b.png");
  });

  it("classifies F95zone error states accurately", () => {
    expect(classifyF95Error("<title>Just a moment...</title>")?.flag).toBe(
      "CLOUDFLARE_CAPTCHA"
    );
    expect(classifyF95Error('<body data-template="f95rl_paused">')?.flag).toBe(
      "F95ZONE_RATELIMIT"
    );
    expect(classifyF95Error("<title>Log in | F95zone</title>")?.flag).toBe(
      "SESSION_LOGGED_OUT"
    );
    expect(
      classifyF95Error(
        '<body data-template="error"><div class="p-body-pageContent"><div class="blockMessage">The requested thread could not be found.</div></div></body>'
      )?.flag
    ).toBe("THREAD_MISSING");
  });
});
