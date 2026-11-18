import type {
  COMPLETION_GROUPINGS,
  PROJECT_DASHBOARD_OPEN_ENTRIES_TABS,
} from "@/components/app/projects/dashboard/project-dashboard.constants";

export type CompletionGrouping = (typeof COMPLETION_GROUPINGS)[number];
export type CompletionRange = { start: string; end: string };
export type CompletionHistoryStatus = "idle" | "loading" | "ready" | "empty" | "partial" | "unavailable";

export interface CompletionHistoryResult {
  status: CompletionHistoryStatus;
  daily: Record<string, number>;
  zone: string;
  error: string;
}

export interface CompletionBucket {
  key: string;
  start: string;
  end: string;
  count: number | null;
  clipped: boolean;
  current: boolean;
  label: string;
  axisLabel: string;
}

export type OpenEntryTab = (typeof PROJECT_DASHBOARD_OPEN_ENTRIES_TABS)[number]["value"];
