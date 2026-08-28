// ---------------------------------------------------------------------------
// text-wrap.ts — Greedy word wrapping for SVG <text> labels
//
// SVG <text> has no automatic wrapping, so multi-line labels have to be split
// into <tspan> lines ourselves. Widths come from an offscreen canvas's
// measureText, cached per (font, maxWidth, text).
//
// Label font size is constant on screen (the label group is counter-scaled
// against the viewport transform), so a given string wraps identically at
// every zoom level — the measurement runs once per string, never per frame.
// ---------------------------------------------------------------------------

/** Font shorthand used for label measurement. Must match the rendered <text>. */
export const LABEL_FONT = "bold 12px sans-serif";

/**
 * Split a formatted category path into wrap tokens.
 *
 * `categoryValueToLabel` emits "Vehicle / Commercial / Truck". Breaking on
 * whitespace alone would strand a lone "/" at the start of a line, so the
 * separator is kept attached to the segment before it — slashes end lines,
 * matching the design.
 */
export function tokenize(text: string): string[] {
  const segments = text.split(" / ");
  return segments.map((segment, i) => (i < segments.length - 1 ? `${segment} /` : segment)).filter((t) => t.length > 0);
}

/**
 * Greedy wrap using an injected width function. Pure — this is the tested core.
 *
 * A token wider than `maxWidth` on its own gets its own line and is allowed to
 * overflow; splitting mid-word would hurt readability more than the overflow
 * does, and the alternative (retrying forever) would hang.
 */
export function wrapTextWith(text: string, maxWidth: number, measure: (s: string) => number): string[] {
  const tokens = tokenize(text);
  if (tokens.length === 0) return [];

  const lines: string[] = [];
  let line = tokens[0];

  for (let i = 1; i < tokens.length; i++) {
    const candidate = `${line} ${tokens[i]}`;
    if (measure(candidate) <= maxWidth) {
      line = candidate;
    } else {
      lines.push(line);
      line = tokens[i];
    }
  }
  lines.push(line);

  return lines;
}

// ── Canvas-backed measurement ───────────────────────────────────────────────

let _ctx: CanvasRenderingContext2D | null | undefined;

/**
 * Shared offscreen 2D context, or null where there is no DOM (unit tests, SSR).
 * Resolved once and memoised — `undefined` means "not yet tried".
 */
function measurementContext(): CanvasRenderingContext2D | null {
  if (_ctx !== undefined) return _ctx;
  try {
    _ctx = document.createElement("canvas").getContext("2d");
  } catch {
    _ctx = null;
  }
  return _ctx;
}

/**
 * Width of `text` in CSS pixels at `font`.
 *
 * Falls back to a crude per-character estimate when no canvas is available, so
 * wrapping degrades to approximate rather than throwing.
 */
export function measureText(text: string, font: string): number {
  const ctx = measurementContext();
  if (!ctx) {
    const size = parseFloat(font.match(/(\d+(?:\.\d+)?)px/)?.[1] ?? "12");
    return text.length * size * 0.6;
  }
  ctx.font = font;
  return ctx.measureText(text).width;
}

const _cache = new Map<string, string[]>();

/**
 * Wrap `text` to `maxWidth` CSS pixels, memoised.
 *
 * The returned array is the cached instance — callers must treat it as
 * read-only so repeated renders of the same label stay reference-stable.
 */
export function wrapText(text: string, maxWidth: number, font: string = LABEL_FONT): string[] {
  const key = `${font}|${maxWidth}|${text}`;
  const cached = _cache.get(key);
  if (cached) return cached;

  const lines = wrapTextWith(text, maxWidth, (s) => measureText(s, font));
  _cache.set(key, lines);
  return lines;
}

/** Clear the wrap cache. Exposed for tests. */
export function clearWrapCache(): void {
  _cache.clear();
}
