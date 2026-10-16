// An export format can declare options of its own beside "Include medias" and
// "Completed Entries Only" (see `/exports/formats`). These helpers turn that
// description into form fields and the values sent with the export.

import type { ExportOptionField, ExportOptionValues } from "@/data/model/sync/exports/type";
import type { LabelValue } from "@/utils/types";

/** How an option is shown in the export dialog. */
export type ExportOptionKind = "select" | "switch" | "number" | "text";

export function exportOptionKind(field: ExportOptionField): ExportOptionKind {
  if (field.choices && field.choices.length > 0) return "select";
  if (field.type === "boolean") return "switch";
  if (field.type === "integer" || field.type === "number") return "number";
  return "text";
}

/** The option's label, or its name made readable ("val_percent" → "Val percent"). */
export function exportOptionLabel(field: ExportOptionField): string {
  if (field.label) return field.label;

  const words = field.name.replace(/_/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** The option's choices for a select, each with its label and, as description, its info. */
export function exportOptionChoices(field: ExportOptionField): Array<LabelValue<string>> {
  return (field.choices ?? []).map((choice) => ({
    label: choice.label,
    description: choice.info,
    value: String(choice.value),
  }));
}

/** Each option at its default, or empty when it has none. */
export function defaultExportOptionValues(fields: Array<ExportOptionField> | undefined): ExportOptionValues {
  return Object.fromEntries((fields ?? []).map((field) => [field.name, field.default ?? null]));
}

/**
 * The values to send for the format's options. Empty values are left out, so
 * the server applies the option's default; numbers typed as text are sent as
 * numbers. The server validates what is sent.
 */
export function exportOptionPayload(
  fields: Array<ExportOptionField> | undefined,
  values: ExportOptionValues,
): ExportOptionValues {
  const payload: ExportOptionValues = {};

  for (const field of fields ?? []) {
    const value = values[field.name];
    if (value === null || value === undefined || value === "") continue;

    const kind = exportOptionKind(field);
    payload[field.name] = kind === "number" && typeof value === "string" ? Number(value) : value;
  }

  return payload;
}
