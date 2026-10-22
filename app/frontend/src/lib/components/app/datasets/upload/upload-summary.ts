import { pluralizeUnit } from "@/utils/unit";

// Footer text for a selection, e.g. "3 items to upload · 2 files ignored".
export function selectionSummary(count: number, unit: string, action: string, ignored: number): string {
  const parts = count > 0 ? [`${count} ${pluralizeUnit(count, unit)} ${action}`] : [];
  if (ignored > 0) parts.push(`${ignored} ${pluralizeUnit(ignored, "file")} ignored`);
  return parts.join(" · ");
}
