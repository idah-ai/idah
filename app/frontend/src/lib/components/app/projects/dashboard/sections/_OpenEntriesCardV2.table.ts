import { EntryRecord } from "@/data/model/dataset/entries/record";
import EntryNameCell from "@/components/app/projects/dashboard/sections/data-table-cells/_EntryNameCell.svelte";
import EntryDatasetCell from "@/components/app/projects/dashboard/sections/data-table-cells/_EntryDatasetCell.svelte";
import EntryStatusCell from "@/components/app/projects/dashboard/sections/data-table-cells/_EntryStatusCell.svelte";
import EntryCurrentStageCell from "@/components/app/projects/dashboard/sections/data-table-cells/_EntryCurrentStageCell.svelte";
import EntryAssignedToCell from "@/components/app/projects/dashboard/sections/data-table-cells/_EntryAssignedToCell.svelte";

import type { DataTableColumnSettings } from "@/components/app/data-table/types";
import type { EntryWorkflowStep } from "@/data/model/dataset/entries/constants";

// ── Time tracking types ──────────────────────────────────────────────

export interface TimeTrackingStepPerson {
  who: string;
  seconds: number;
}

export interface TimeTrackingStep {
  stage: string;
  performedBy: string;
  seconds: number;
  people?: TimeTrackingStepPerson[];
}

export interface EntryWithTimeData extends EntryRecord {
  totalSeconds: number;
  steps: TimeTrackingStep[];
  expanded?: boolean;
}

// ── Time formatting (hh:mm:ss) ───────────────────────────────────────

export function formatSeconds(totalSeconds: number): string {
  if (totalSeconds <= 0) return "—";
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// ── Mock data enrichment (placeholder until BE is ready) ──────────────

const MOCK_STEP_NAMES: Record<string, string> = {
  pending: "Pending",
  annotation: "Annotation",
  review: "Review",
  completed: "Done",
};

export function enrichWithTimeData(entry: EntryRecord): EntryWithTimeData {
  const wfStep = entry.wf_step || "pending";
  const stepNames = Object.values(MOCK_STEP_NAMES);
  const currentIdx = stepNames.indexOf(MOCK_STEP_NAMES[wfStep] || "Pending");
  const steps: TimeTrackingStep[] = [];
  const assigneeName = entry.assigned_to_email || "Unassigned";

  stepNames.forEach((name, i) => {
    if (i > currentIdx && name !== "Done") return;
    if (name === "Done" && wfStep !== "done") return;
    const baseSeconds = (Math.floor(Math.random() * 120) + 10) * 60;
    steps.push({
      stage: name,
      performedBy: assigneeName,
      seconds: baseSeconds,
      people: [
        { who: assigneeName, seconds: baseSeconds },
      ],
    });
  });

  // Add a "Done" step for completed entries
  if (wfStep === "done" && !steps.find((s) => s.stage === "Done")) {
    steps.push({
      stage: "Done",
      performedBy: assigneeName,
      seconds: (Math.floor(Math.random() * 30) + 5) * 60,
    });
  }

  const totalSeconds = steps.reduce((sum, s) => sum + s.seconds, 0);

  const enriched = entry as unknown as EntryWithTimeData;
  enriched.totalSeconds = totalSeconds;
  enriched.steps = steps;
  enriched.expanded = false;

  return enriched;
}

// ── Columns configuration ────────────────────────────────────────────

// Total time sort key — used by the card for client-side sorting
export const TOTAL_TIME_SORT_KEY = "totalSeconds";

export function getColumns(overview: boolean): DataTableColumnSettings<EntryWithTimeData> {
  return {
    entry: {
      key: "name",
      title: "Entry",
      cellComponent: EntryNameCell,
    },
    ...(overview
      ? {
          dataset: {
            key: "dataset",
            title: "Dataset",
            cellComponent: EntryDatasetCell,
          },
        }
      : {}),
    status: {
      key: "status",
      title: "Current status",
      cellComponent: EntryStatusCell,
    },
    stage: {
      key: "wf_step",
      title: "Current stage",
      cellComponent: EntryCurrentStageCell,
      sortable: true,
    },
    assigned_to: {
      key: "assigned_to",
      title: "Assigned to",
      cellComponent: EntryAssignedToCell,
    },
    total_time: {
      key: TOTAL_TIME_SORT_KEY,
      title: "Total time spent",
      align: "right",
      sortable: true,
    },
  };
}