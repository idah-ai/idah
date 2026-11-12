import { pluralizeUnit } from "@/utils/unit";

// Footer text for a selection, e.g. "3 items to upload"; empty when nothing is selected.
export function selectionSummary(count: number, unit: string, action: string): string {
  return count > 0 ? `${count} ${pluralizeUnit(count, unit)} ${action}` : "";
}
