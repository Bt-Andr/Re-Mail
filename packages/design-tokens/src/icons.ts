// Icon size scale, per the product owner's spec:
// nav/toolbar icons 24px (44-48px min tap target), inline status icons 16-20px,
// swipe-action icons 20-24px, avatars 36-40px.
//
// Plain numbers (px) — used directly as the `size` prop on lucide icons (web and
// mobile's lucide-react-native both accept a numeric `size`), as RN `width`/`height`
// style values, or interpolated into Tailwind arbitrary-value classes if needed.

export const icons = {
  /** Nav/toolbar icons (header actions, tab bar, etc). */
  nav: 24,
  /** Inline status icons (e.g. read/unread markers, small badges). */
  inlineStatus: {
    sm: 16,
    lg: 20,
  },
  /** Icons revealed by list-item swipe actions (archive/trash/restore...). */
  swipeAction: {
    sm: 20,
    lg: 24,
  },
  /** Avatar circles (sender initials, etc). */
  avatar: {
    sm: 36,
    lg: 40,
  },
  /** Minimum touch target size for any tappable icon — not a rendered icon size itself. */
  minTouchTarget: 44,
} as const;
