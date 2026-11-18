import type { ExportRecord } from "@/data/model/sync/exports/record";
import type { SyncJobRecord } from "@/data/model/sync/jobs/record";

export type ExportKind = "entry" | "dataset";
export type ExportStatus = "ready" | "error" | "inProgress";

/** Raw job arguments from an export record (job relationship may be absent). */
export function getExportJobArguments(exportRecord: ExportRecord): Record<string, unknown> {
  const job = exportRecord.job as unknown as SyncJobRecord | undefined;
  return (job?.arguments as Record<string, unknown>) ?? {};
}

/** Entry exports carry an `entry_ids` key in the job arguments. */
export function classifyExport(exportRecord: ExportRecord): ExportKind {
  const entryIds = getExportJobArguments(exportRecord).entry_ids as Array<string> | undefined;
  return entryIds && entryIds.length > 0 ? "entry" : "dataset";
}

/** Single kind when every export is the same type, "mixed" otherwise. */
export function summarizeExportKinds(records: ExportRecord[]): ExportKind | "mixed" {
  const kinds = new Set(records.map(classifyExport));

  if (kinds.size === 1) return [...kinds][0] as ExportKind;
  return "mixed";
}

const statusWords: Record<ExportStatus, string> = {
  ready: "ready",
  error: "error",
  inProgress: "in progress...",
};

/**
 * Human-readable summary label for a batch of exports, e.g.
 * "Entry export ready", "Dataset export error", or "Exports in progress...".
 */
export function exportSummaryLabel(records: ExportRecord[], status: ExportStatus): string {
  const kind = summarizeExportKinds(records);

  const verb = statusWords[status];
  if (records.length === 0) return `Export ${verb}`;
  if (kind === "mixed") return `Exports ${verb}`;
  return `${kind === "entry" ? "Entry export" : "Dataset export"} ${verb}`;
}

/**
 * Compact item name. Entry exports are summarized by count + dataset name so
 * the floating card never has to fetch hundreds of entry records.
 */
export function buildExportItemName(exportRecord: ExportRecord, datasetNames: string[]): string {
  const args = getExportJobArguments(exportRecord);
  const entryIds = args.entry_ids as Array<string> | undefined;
  const datasetLabel = datasetNames.join(", ");

  if (entryIds && entryIds.length > 0) {
    return `${entryIds.length} ${entryIds.length === 1 ? "entry" : "entries"} · ${datasetLabel}`;
  }

  return datasetLabel;
}
