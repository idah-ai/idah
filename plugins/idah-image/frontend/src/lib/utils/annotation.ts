// ---------------------------------------------------------------------------
// utils/annotation.ts — Shared annotation helpers
// ---------------------------------------------------------------------------

/** Format a category path like "vehicles/car" into a human-readable label like "Vehicles / Car". */
export function categoryValueToLabel(value?: string, replaceLabel?: string): string {
  if (!value) return "";
  const label = value.split("/").map((s) => s.slice(0, 1).toUpperCase() + s.slice(1));
  if (replaceLabel) {
    label[label.length - 1] = replaceLabel;
  } else {
    label.pop();
  }
  return label.join(" / ");
}
