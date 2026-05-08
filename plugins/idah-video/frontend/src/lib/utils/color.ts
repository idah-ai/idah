// ---------------------------------------------------------------------------
// color.ts — Color utilities for annotation rendering
//
// Supports two modes:
//   "category" — uses the color from the project's label config (IConfigValue.color)
//   "random"   — generates a deterministic HSL color from the annotation's id,
//                avoiding overly bright or dark shades
// ---------------------------------------------------------------------------

/**
 * Generate a hash from a string (simple FNV-1a 32-bit).
 */
function fnv1a(str: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * Generate a deterministic HSL color from an annotation id.
 *
 * Strategy:
 *   - Hue: evenly distributed across [0, 360) using the hash
 *   - Saturation: fixed at 60% — vivid enough to be distinguishable but not neon
 *   - Lightness: fixed at 50% — visible on both light and dark backgrounds
 *
 * Returns an `hsl(hue, sat%, light%)` string.
 */
function hslFromId(id: string): string {
  const hash = fnv1a(id);
  const hue = (hash % 360) + (hash / 360);
  return `hsl(${hue % 360}, 60%, 50%)`;
}

/**
 * Compute the display color for an annotation based on the current color mode.
 *
 * @param colorMode   "category" | "random"
 * @param annotation  The annotation record (must have at least `id` and optionally `value.category`).
 * @param configByType The shape config for the annotation's type, or undefined to look up by type.
 * @returns           A CSS color string (HSL or hex).
 */
export function annotationColor(
  colorMode: "category" | "random",
  annotation: { id?: string; value?: { category?: string }; shape?: { type?: string } },
  getCategoryColor?: (categoryId: string) => string | null | undefined,
): string {
  if (colorMode === "category" && getCategoryColor && annotation.value?.category) {
    const catColor = getCategoryColor(annotation.value.category);
    if (catColor) return catColor;
  }
  // Fallback: deterministic HSL from id
  return hslFromId(annotation.id ?? "");
}
