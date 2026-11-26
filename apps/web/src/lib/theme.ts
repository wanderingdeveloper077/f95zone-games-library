import { APP_THEME_IDS, type AppThemeId } from "@game-library/shared";

export const THEME_STORAGE_KEY = "gl_theme";

export type EffectiveDomTheme = Exclude<AppThemeId, "system">;

export interface ResolvedDomTheme {
  effectiveTheme: EffectiveDomTheme;
  isDark: boolean;
}

export function isAppThemeId(value: unknown): value is AppThemeId {
  return (
    typeof value === "string" &&
    (APP_THEME_IDS as readonly string[]).includes(value)
  );
}

export function readInitialTheme(): AppThemeId {
  try {
    if (
      typeof localStorage !== "undefined" &&
      typeof localStorage.getItem === "function"
    ) {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      if (isAppThemeId(stored)) {
        return stored;
      }
    }
  } catch {
    // Ignore storage read errors.
  }
  return "dark";
}

export function persistTheme(theme: AppThemeId): void {
  try {
    if (
      typeof localStorage !== "undefined" &&
      typeof localStorage.setItem === "function"
    ) {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    }
  } catch {
    // Ignore storage write errors.
  }
}

export function resolveDomTheme(
  theme: AppThemeId,
  systemPrefersDark: boolean
): ResolvedDomTheme {
  if (theme === "system") {
    return {
      effectiveTheme: systemPrefersDark ? "dark" : "light",
      isDark: systemPrefersDark,
    };
  }
  if (theme === "light") {
    return {
      effectiveTheme: "light",
      isDark: false,
    };
  }
  return {
    effectiveTheme: theme,
    isDark: true,
  };
}

export function applyThemeToDocument(
  theme: AppThemeId,
  doc?: Document,
  systemPrefersDark?: boolean
): ResolvedDomTheme | null {
  const targetDoc =
    doc ?? (typeof document !== "undefined" ? document : undefined);
  if (!targetDoc) return null;

  const prefersDark =
    systemPrefersDark ??
    (typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
      : true);

  const resolved = resolveDomTheme(theme, prefersDark);
  const root = targetDoc.documentElement;
  root.classList.toggle("dark", resolved.isDark);
  root.dataset.theme = resolved.effectiveTheme;
  return resolved;
}
