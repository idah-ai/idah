// diff-lines.ts — turn one stored annotation change row into display lines.
//
// Input: `changes` as stored by the backend (`annotation_changes.changes`):
//   [op, path, old, new][]  with op "+" | "-" | "~"
// Output: lines { sign, text, kind } where `text` already carries the indentation
// (2 spaces per depth). Render `text` with `white-space: pre`.
//
// Path parsing mirrors AnnotationDiff.parse_path / escape / unescape
// (app/dataset/app/util/annotation_diff.rb).

export type ChangeEntry = ["+" | "-" | "~", string, unknown, unknown];
export type LineKind = "add" | "del" | "ctx" | "more";
export interface DiffLine {
  sign: "+" | "-" | " ";
  text: string;
  kind: LineKind;
  /** True when the value was cut by the per-value length cap. */
  truncated?: boolean;
}

const INDENT = "  ";
export const MAX_LINES = 200;

// ── Path parsing ────────────────────────────────────────────────────────────

interface Segment {
  /** Raw segment as written in the path; used to compare parents between entries. */
  raw: string;
  name: string;
  /** Present for keyed segments `name[key=value]`. */
  keyed?: { key: string; value: unknown };
}

// Same pattern as the backend's SEGMENT_RE:
//   ((?:\\.|[^\[\].\\])+)(?:\[((?:\\.|[^\]])*)\])?
const SEGMENT_RE = /((?:\\.|[^[\].\\])+)(?:\[((?:\\.|[^\]])*)\])?/g;

const unescapeName = (s: string) => s.replace(/\\([.[\]\\])/g, "$1");
const unescapeBracket = (s: string) => s.replace(/\\([\]\\])/g, "$1");

export function parsePath(path: string): Segment[] {
  const out: Segment[] = [];
  for (const m of path.matchAll(SEGMENT_RE)) {
    const [raw, name, inner] = m;
    if (inner === undefined) {
      out.push({ raw, name: unescapeName(name) });
      continue;
    }
    const body = unescapeBracket(inner);
    const eq = body.indexOf("=");
    const key = body.slice(0, eq);
    const json = body.slice(eq + 1);
    let value: unknown = json;
    try {
      value = JSON.parse(json);
    } catch {
      /* keep the raw text */
    }
    out.push({ raw, name, keyed: { key, value } });
  }
  return out;
}

// ── Value formatting ────────────────────────────────────────────────────────

/** A single value longer than this is cut; the line is marked `truncated`. */
export const MAX_VALUE_CHARS = 2048;

/**
 * Build the inline text for a value structurally, so only the separators
 * between array items / object entries get a space — commas inside strings
 * (e.g. "1,000") are left untouched. Arrays become `[a, b]`, objects `{"k": v}`.
 */
function formatInline(v: unknown): string {
  if (v === undefined || v === null) return "null";
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(formatInline).join(", ")}]`;
  if (typeof v === "object") {
    const entries = Object.entries(v as Record<string, unknown>);
    return `{${entries.map(([k, val]) => `${JSON.stringify(k)}:${formatInline(val)}`).join(", ")}}`;
  }
  return JSON.stringify(v);
}

/** The inline text for a value, cut to `MAX_VALUE_CHARS` unless `fullValues`. */
function inlineParts(v: unknown, fullValues: boolean): { text: string; truncated: boolean } {
  if (v === undefined) return { text: "null", truncated: false };
  const s = formatInline(v);
  if (!fullValues && s.length > MAX_VALUE_CHARS) {
    return { text: `${s.slice(0, MAX_VALUE_CHARS)}…`, truncated: true };
  }
  return { text: s, truncated: false };
}

/** Compact JSON with ", " after separators: [[0.7, 0.52], [0.78, 0.67]]. */
export function inlineValue(v: unknown, fullValues = false): string {
  return inlineParts(v, fullValues).text;
}

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v);

/** Scalars, null, {}, arrays of scalars and arrays of arrays stay on one line. */
function isInline(v: unknown): boolean {
  if (v === null || typeof v !== "object") return true;
  if (Array.isArray(v)) return v.every((x) => x === null || typeof x !== "object" || Array.isArray(x));
  return Object.keys(v).length === 0;
}

type Raw = { sign: DiffLine["sign"]; depth: number; text: string; truncated?: boolean };

function emitValue(out: Raw[], sign: Raw["sign"], depth: number, key: string, v: unknown, fullValues: boolean) {
  if (isInline(v)) {
    const { text, truncated } = inlineParts(v, fullValues);
    out.push({ sign, depth, text: `${key}: ${text}`, truncated });
    return;
  }
  out.push({ sign, depth, text: `${key}:` });
  if (Array.isArray(v)) v.forEach((item) => emitItem(out, sign, depth + 1, item, undefined, fullValues));
  else
    Object.entries(v as Record<string, unknown>).forEach(([k, child]) =>
      emitValue(out, sign, depth + 1, k, child, fullValues),
    );
}

/** One array element: `- firstKey: value`, then the other keys one level deeper. */
function emitItem(
  out: Raw[],
  sign: Raw["sign"],
  depth: number,
  item: unknown,
  idKey: string | undefined,
  fullValues: boolean,
) {
  if (!isPlainObject(item)) {
    const { text, truncated } = inlineParts(item, fullValues);
    out.push({ sign, depth, text: `- ${text}`, truncated });
    return;
  }
  const keys = Object.keys(item);
  if (keys.length === 0) {
    out.push({ sign, depth, text: "- {}" });
    return;
  }
  const first = idKey && keys.includes(idKey) ? idKey : keys[0];
  const firstVal = item[first];
  if (isInline(firstVal)) {
    const { text, truncated } = inlineParts(firstVal, fullValues);
    out.push({ sign, depth, text: `- ${first}: ${text}`, truncated });
  } else {
    // Rare: the first key holds an object or a list of objects. Its content goes two levels deeper.
    out.push({ sign, depth, text: `- ${first}:` });
    if (Array.isArray(firstVal)) firstVal.forEach((x) => emitItem(out, sign, depth + 2, x, undefined, fullValues));
    else
      Object.entries(firstVal as Record<string, unknown>).forEach(([k, c]) =>
        emitValue(out, sign, depth + 2, k, c, fullValues),
      );
  }
  keys.filter((k) => k !== first).forEach((k) => emitValue(out, sign, depth + 1, k, item[k], fullValues));
}

// ── Main ────────────────────────────────────────────────────────────────────

/** Context lines for the parents of a path. A keyed segment gives two lines: `name:` and `- key: value`. */
function parentLines(segs: Segment[], fullValues: boolean): { raw: string; text: string }[] {
  const lines: { raw: string; text: string }[] = [];
  for (const s of segs) {
    lines.push({ raw: s.name, text: `${s.name}:` });
    if (s.keyed) {
      lines.push({ raw: s.raw, text: `- ${s.keyed.key}: ${inlineValue(s.keyed.value, fullValues)}` });
    }
  }
  return lines;
}

/**
 * `cap`: maximum lines before a "Show N more lines" row; pass Infinity for the full list.
 * `opts.fullValues`: skip the per-value length cap (used by "Show full value").
 */
export function diffLines(
  changes: ChangeEntry[],
  cap: number = MAX_LINES,
  opts: { fullValues?: boolean } = {},
): DiffLine[] {
  const fullValues = opts.fullValues ?? false;
  const raw: Raw[] = [];
  let prevParents: string[] = [];

  for (const [op, path, oldValue, newValue] of changes) {
    const segs = parsePath(path);
    const leaf = segs[segs.length - 1];
    // Parents = every segment before the leaf, plus the leaf's array name when the leaf is keyed.
    const parentSegs = segs.slice(0, -1);
    const parents = parentLines(parentSegs, fullValues);
    if (leaf.keyed) parents.push({ raw: leaf.name, text: `${leaf.name}:` });

    let common = 0;
    while (common < parents.length && common < prevParents.length && prevParents[common] === parents[common].raw) {
      common++;
    }
    for (let i = common; i < parents.length; i++) raw.push({ sign: " ", depth: i, text: parents[i].text });
    prevParents = parents.map((p) => p.raw);

    const depth = parents.length;
    const write = (sign: "+" | "-", v: unknown) => {
      if (leaf.keyed) {
        // The whole keyed item was added/removed/replaced: identity key on the dash line.
        const item = isPlainObject(v) ? v : { [leaf.keyed.key]: leaf.keyed.value, value: v };
        emitItem(raw, sign, depth, item, leaf.keyed.key, fullValues);
      } else {
        emitValue(raw, sign, depth, leaf.name, v, fullValues);
      }
    };

    if (op === "~") {
      write("-", oldValue);
      write("+", newValue);
    } else if (op === "+") write("+", newValue);
    else write("-", oldValue);
  }

  const lines: DiffLine[] = raw.map((l) => ({
    sign: l.sign,
    text: INDENT.repeat(l.depth) + l.text,
    kind: l.sign === "+" ? "add" : l.sign === "-" ? "del" : "ctx",
    truncated: l.truncated,
  }));

  if (lines.length > cap) {
    const hidden = lines.length - cap;
    return [...lines.slice(0, cap), { sign: " ", text: `Show ${hidden} more lines`, kind: "more" }];
  }
  return lines;
}

/** First `[frame=N]` key in a row's paths. */
export function firstFrame(changes: ChangeEntry[]): number | null {
  for (const [, path] of changes) {
    for (const s of parsePath(path)) {
      if (s.keyed?.key === "frame" && typeof s.keyed.value === "number") return s.keyed.value;
    }
  }
  return null;
}
