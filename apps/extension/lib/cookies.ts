import type { CookieItem } from "@game-library/shared";
import { browser } from "wxt/browser";

/**
 * Extract all F95zone cookies (including HttpOnly cookies like xf_user and cf_clearance)
 * paired with the browser's exact User-Agent string. Must only run in background context.
 */
export async function extractF95SessionPayload(): Promise<{
  cookies: CookieItem[];
  userAgent: string;
}> {
  const rawCookies = await browser.cookies.getAll({ domain: "f95zone.to" });
  const cookies: CookieItem[] = rawCookies
    .filter((c) => Boolean(c.name))
    .map((c) => ({
      name: c.name,
      value: c.value ?? "",
      domain: c.domain || ".f95zone.to",
      path: c.path || "/",
      httpOnly: Boolean(c.httpOnly),
      secure: Boolean(c.secure),
      ...(typeof c.expirationDate === "number"
        ? { expirationDate: c.expirationDate }
        : {}),
    }));

  return {
    cookies,
    userAgent: navigator.userAgent,
  };
}
