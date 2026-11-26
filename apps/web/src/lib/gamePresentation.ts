import {
  type AccountStatusValue,
  type GameSummary,
  TagHighlight,
  type TagHighlightId,
} from "@game-library/shared";

export interface SessionStatusPresentation {
  headerLabel: string;
  headerButtonClass: string;
  badgeVariant: "secondary" | "success" | "warning" | "destructive";
  isWarning: boolean;
  bannerMessage: string | null;
}

export const SESSION_STATUS_CONFIG: Record<
  AccountStatusValue,
  SessionStatusPresentation
> = {
  unconfigured: {
    headerLabel: "Session: Not Paired",
    headerButtonClass:
      "border-neutral-700 bg-neutral-900 text-neutral-300 hover:bg-neutral-800",
    badgeVariant: "secondary",
    isWarning: false,
    bannerMessage: null,
  },
  active: {
    headerLabel: "Session: Active",
    headerButtonClass:
      "border-emerald-700/60 bg-emerald-950/50 text-emerald-300 hover:bg-emerald-950/80 hover:text-emerald-200",
    badgeVariant: "success",
    isWarning: false,
    bannerMessage: null,
  },
  captcha_required: {
    headerLabel: "Cloudflare Challenge",
    headerButtonClass:
      "border-amber-600/70 bg-amber-950/50 text-amber-300 hover:bg-amber-950/80 hover:text-amber-200",
    badgeVariant: "warning",
    isWarning: true,
    bannerMessage:
      "Cloudflare challenge detected. Visit f95zone.to in your paired browser, pass the check normally, and click Sync Session in the extension.",
  },
  expired: {
    headerLabel: "Session Expired",
    headerButtonClass:
      "border-rose-700/70 bg-rose-950/50 text-rose-300 hover:bg-rose-950/80 hover:text-rose-200",
    badgeVariant: "destructive",
    isWarning: true,
    bannerMessage:
      "Your F95zone session expired. Log in via your browser and sync cookies with the extension.",
  },
};

export function getSessionStatusPresentation(
  status: AccountStatusValue | undefined
): SessionStatusPresentation {
  return status
    ? SESSION_STATUS_CONFIG[status]
    : SESSION_STATUS_CONFIG.unconfigured;
}

export interface TagHighlightPresentation {
  label: string;
  badgeClass: string;
  pillClass: string;
}

export const DEFAULT_TAG_BADGE_CLASS = "border-border bg-card text-neutral-300";

export const TAG_HIGHLIGHT_CONFIG: Record<
  TagHighlightId,
  TagHighlightPresentation
> = {
  [TagHighlight.Positive]: {
    label: "Positive",
    badgeClass: "border-emerald-700 bg-emerald-900/70 text-emerald-200",
    pillClass: "border-emerald-700 bg-emerald-800/80 text-white",
  },
  [TagHighlight.Negative]: {
    label: "Negative",
    badgeClass: "border-rose-700 bg-rose-900/70 text-rose-200",
    pillClass: "border-rose-700 bg-rose-800/80 text-white",
  },
  [TagHighlight.Critical]: {
    label: "Critical",
    badgeClass: "border-neutral-500 bg-black text-white",
    pillClass: "border-neutral-500 bg-black text-white",
  },
};

export function getTagHighlightPresentation(
  level: TagHighlightId | undefined
): TagHighlightPresentation | null {
  return level !== undefined ? TAG_HIGHLIGHT_CONFIG[level] : null;
}

export interface GameInstallState {
  isInstalledCurrent: boolean;
  isInstalledOld: boolean;
  isFinishedCurrent: boolean;
}

export function getGameInstallState(
  game: Pick<GameSummary, "version" | "installedVersion" | "finishedVersion">
): GameInstallState {
  const isInstalledCurrent =
    Boolean(game.installedVersion) && game.installedVersion === game.version;
  const isInstalledOld =
    Boolean(game.installedVersion) && game.installedVersion !== game.version;
  const targetVersion = game.installedVersion || game.version;
  const isFinishedCurrent =
    Boolean(game.finishedVersion) && game.finishedVersion === targetVersion;

  return {
    isInstalledCurrent,
    isInstalledOld,
    isFinishedCurrent,
  };
}

export function getNextInstalledVersion(
  game: Pick<GameSummary, "version" | "installedVersion">
): string {
  const isInstalledCurrent =
    game.installedVersion === game.version && game.version !== "";
  return isInstalledCurrent ? "" : game.version;
}

export function getNextFinishedVersion(
  game: Pick<GameSummary, "version" | "installedVersion" | "finishedVersion">
): string {
  const targetVersion = game.installedVersion || game.version;
  const isFinishedCurrent =
    Boolean(game.finishedVersion) && game.finishedVersion === targetVersion;
  return isFinishedCurrent ? "" : targetVersion;
}

export function formatUnixDate(sec: number): string {
  if (!sec) return "—";
  return new Date(sec * 1000).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function countActiveAdvancedFilters(filter: {
  status: string;
  type: string;
  installed: string;
  finished: string;
  tags: readonly number[];
}): number {
  return (
    (filter.status ? 1 : 0) +
    (filter.type ? 1 : 0) +
    (filter.installed !== "all" ? 1 : 0) +
    (filter.finished !== "all" ? 1 : 0) +
    filter.tags.length
  );
}

export function getSfwImageBlurClass(sfwMode: boolean): string {
  return sfwMode ? "scale-110 blur-xl group-hover:scale-110" : "";
}
