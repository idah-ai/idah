// ---------------------------------------------------------------------------
// color.ts — Color utilities for annotation rendering
//
// Supports two modes:
//   "category" — uses the color from the project's label config (IConfigValue.color)
//   "random"   — generates a deterministic HSL color from the annotation's id,
//                avoiding overly bright or dark shades
// ---------------------------------------------------------------------------
import { ui } from "$lib/state/ui.svelte";
import { getDriver } from "$lib/state/driver.svelte";

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
 * Generate a deterministic hex color from an annotation id.
 *
 * Returns a hex string like `#F6402B` so callers can safely append
 * a two-digit alpha suffix (e.g. `#F6402B30`).
 */
function hslFromId(id: string): string {
  const hash = fnv1a(id);
  const hue = (hash % 360) + (hash / 360);
  const sat = ((hash*3) % 20) + 50;
  return hslToHex(hue % 360, sat, 50);
}

/** Convert HSL values to a hex color string. */
function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
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

/**
 * Convenience helper that resolves an annotation's display color using the
 * UI's current color mode and the driver config's category colors.
 *
 * Usage in a $derived.by:
 *   let color = $derived.by(() => resolveAnnotationColor(annotation));
 */
export function resolveAnnotationColor(
  annotation: { id?: string; value?: { category?: string }; shape?: { type?: string } },
): string {
  return annotationColor(ui.colorMode, annotation, (catId: string) => {
    const config = getDriver().config[annotation?.shape?.type ?? ""];
    return config?.values?.find((v) => v.id === catId)?.color ?? null;
  });
}
