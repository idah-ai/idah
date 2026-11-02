/** Type of an export format's own option, as `/exports/formats` describes it. */
export type ExportOptionType = "string" | "boolean" | "integer" | "number";

/** One allowed value of an option, explained for the export dialog. */
export interface ExportOptionChoice {
  value: string | number;
  label: string;
  /** What the choice does, shown under it. */
  info?: string;
}

/** An option an export format declares beside "Include medias" and "Completed Entries Only". */
export interface ExportOptionField {
  name: string;
  type: ExportOptionType;
  default?: string | number | boolean | null;
  required: boolean;
  label?: string;
  description?: string;
  choices?: Array<ExportOptionChoice>;
  min?: number;
  max?: number;
}

/** Values of a format's options, by option name. */
export type ExportOptionValues = Record<string, string | number | boolean | null>;

export interface ExportFormat {
  name: string;
  description: string;
  exporter: string;
  options?: Array<ExportOptionField>;
}
