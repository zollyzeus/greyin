// categories.color (001_initial_schema.sql) is a plain, unconstrained
// TEXT column -- nothing in the schema stops a value that would vanish
// against one of this app's two themed card backgrounds (bg-white /
// dark:bg-gray-900). There is no admin UI to edit it today (the 4 real
// rows were seeded once directly via SQL, all safe, mid-range colors),
// so this is a defensive guard for whenever that UI gets built, not a
// fix for a live incident. Since this renders server-side with no way
// to know the viewer's actual theme (the dark-mode toggle is a
// client-side localStorage choice), the only safe approach is to reject
// colors extreme enough to fail against EITHER background rather than
// try to pick per-theme -- a color needs to sit in a mid-luminance band
// to read reasonably on both a near-white and a near-black card.
const FALLBACK_COLOR = '#2563eb'

function relativeLuminance(hex: string): number | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return null
  const int = parseInt(m[1], 16)
  const r = ((int >> 16) & 255) / 255
  const g = ((int >> 8) & 255) / 255
  const b = (int & 255) / 255
  // Simplified perceptual luminance (no sRGB gamma correction) -- a
  // coarse legibility guard, not a WCAG contrast-ratio calculation.
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function safeCategoryColor(color: string | null | undefined): string {
  if (!color) return FALLBACK_COLOR
  const luminance = relativeLuminance(color)
  if (luminance === null) return FALLBACK_COLOR
  // Too dark: unreadable on dark:bg-gray-900. Too light: unreadable on
  // bg-white. Anything in between reads acceptably on both.
  if (luminance < 0.15 || luminance > 0.85) return FALLBACK_COLOR
  return color
}
