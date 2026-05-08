import type { IConfigProperty } from "$idah/v2/types";
import type { IConfigValue } from "$idah/v2/types";

export type { IConfigProperty, IConfigValue };

// V1 compatibility types - re-exported from V2 types
export interface IConfigPropertyStyles {
  border?: string;
  opacity?: number;
  dashArray?: string;
  strokeColor?: string;
  width?: string;
}

export interface ICommandsDriver {
  run(name: string, ...args: unknown[]): unknown;
}

export interface IActivityContext {
  commands?: ICommandsDriver;
  shortcutReferences?: Record<string, { label: string; description: string; keyCombinations: string[] }>;
  // Placeholder for V1 compatibility
  [key: string]: unknown;
}
