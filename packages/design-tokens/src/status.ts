// Canonical status → color mapping for the whole product (web, mobile, webmail).
//
// Source of truth: web/src/components/ui/Badge.tsx's `statusBadgeColor()`, which the
// product owner picked as canonical over mobile's (previously divergent) STATUS_CLASS
// in mobile/src/components/inbox/ThreadListItem.tsx. Mobile's mapping is being
// reconciled toward this file in a later track — do not re-derive values from mobile.
//
// Covers both thread statuses (`nouveau` / `en_cours` / `resolu`) and invite statuses
// (`PENDING` / `ACTIVATED` / `REVOKED`, which mobile doesn't render yet but this file
// already accounts for).
//
// Hex values below are hand-copied from Tailwind's stock palette (`tailwindcss/colors`,
// v3.4.19 as installed in this monorepo) at the exact shades web already uses:
// amber-500/700/400, blue-500/700/400, emerald-500/700/400, red-500/700/400. Confirmed
// via `node -e "console.log(require('tailwindcss/colors').amber[500])"` etc. — these are
// stable, versioned Tailwind constants, not arbitrary picks.

export type ThreadStatus = "nouveau" | "en_cours" | "resolu";
export type InviteStatus = "PENDING" | "ACTIVATED" | "REVOKED";
export type StatusKey = ThreadStatus | InviteStatus;

export type StatusColorFamily = "amber" | "blue" | "emerald" | "red";

export interface StatusColorToken {
  /** Tailwind stock color family backing this status. */
  family: StatusColorFamily;
  /**
   * Ready-to-use Tailwind utility classes — identical string to what
   * web/src/components/ui/Badge.tsx's `COLORS` map produces today.
   * Works as-is in mobile too once `tailwind-preset.cjs` is wired into
   * `mobile/tailwind.config.js` (NativeWind resolves stock Tailwind
   * classes, including the `/10` opacity modifier, natively).
   */
  className: string;
  /**
   * Plain hex values for contexts with no Tailwind classes available
   * (RN `color`/`fill` props on non-NativeWind components, inline
   * `style={}`, canvas/SVG, etc).
   */
  hex: {
    /** 500 shade — badge background tint; the class form applies this at 10% opacity. */
    bg: string;
    /** 700 shade — badge text color in light mode. */
    textLight: string;
    /** 400 shade — badge text color in dark mode. */
    textDark: string;
  };
}

const FAMILY_TOKENS: Record<StatusColorFamily, Omit<StatusColorToken, "family">> = {
  amber: {
    className: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
    hex: { bg: "#f59e0b", textLight: "#b45309", textDark: "#fbbf24" },
  },
  blue: {
    className: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
    hex: { bg: "#3b82f6", textLight: "#1d4ed8", textDark: "#60a5fa" },
  },
  emerald: {
    className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    hex: { bg: "#10b981", textLight: "#047857", textDark: "#34d399" },
  },
  red: {
    className: "bg-red-500/10 text-red-700 dark:text-red-400",
    hex: { bg: "#ef4444", textLight: "#b91c1c", textDark: "#f87171" },
  },
};

function fromFamily(family: StatusColorFamily): StatusColorToken {
  return { family, ...FAMILY_TOKENS[family] };
}

/**
 * The canonical status → color map. Thread statuses `nouveau`/`en_cours`/`resolu`
 * and invite statuses `PENDING`/`ACTIVATED`/`REVOKED` share this single source —
 * `PENDING` mirrors `nouveau` (amber) and `ACTIVATED` mirrors `resolu` (emerald/green),
 * matching Badge.tsx's `statusBadgeColor()` exactly.
 */
export const statusColors: Record<StatusKey, StatusColorToken> = {
  nouveau: fromFamily("amber"),
  en_cours: fromFamily("blue"),
  resolu: fromFamily("emerald"),
  PENDING: fromFamily("amber"),
  ACTIVATED: fromFamily("emerald"),
  REVOKED: fromFamily("red"),
};

/** Flat `status -> Tailwind className` map, for direct spread into `className` props. */
export const statusClassName: Record<StatusKey, string> = Object.fromEntries(
  Object.entries(statusColors).map(([key, token]) => [key, token.className])
) as Record<StatusKey, string>;

/** Unknown/fallback status color — matches Badge.tsx's 'gray' default (semantic, not a stock hue). */
export const statusColorFallback = {
  className: "bg-muted text-muted-foreground",
} as const;
