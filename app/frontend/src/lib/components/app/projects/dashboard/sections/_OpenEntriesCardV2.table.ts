import { EntryRecord, EntryWorkTimeRecord } from "@/data/model/dataset/entries/record";
import EntryNameCell from "@/components/app/projects/dashboard/sections/data-table-cells/_EntryNameCell.svelte";
import EntryDatasetCell from "@/components/app/projects/dashboard/sections/data-table-cells/_EntryDatasetCell.svelte";
import EntryStatusCell from "@/components/app/projects/dashboard/sections/data-table-cells/_EntryStatusCell.svelte";
import EntryCurrentStageCell from "@/components/app/projects/dashboard/sections/data-table-cells/_EntryCurrentStageCell.svelte";
import EntryAssignedToCell from "@/components/app/projects/dashboard/sections/data-table-cells/_EntryAssignedToCell.svelte";
import TotalTimeSpentHeaderCell from "@/components/app/projects/dashboard/sections/_TotalTimeSpentHeaderCell.svelte";

import type { DataTableColumnSettings } from "@/components/app/data-table/types";
import { entryWorkflowSteps } from "@/data/model/dataset/entries/constants";

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

// ── Real data enrichment from time_tracking + entry_work_times ───────

const wfStepLabels: Record<string, string> = {};
for (const step of entryWorkflowSteps) {
  wfStepLabels[step.value] = step.label;
}

export function enrichWithTimeData(entry: EntryRecord): EntryWithTimeData {
  let totalSeconds = 0;
  const steps: TimeTrackingStep[] = [];
  const allWorkTimes = (entry.entry_work_times as EntryWorkTimeRecord[] | undefined) ?? [];

  // 1. Finalized time from the time_tracking JSONB cache
  if (entry.time_tracking) {
    for (const [wfStep, seconds] of Object.entries(entry.time_tracking)) {
      if (seconds <= 0) continue;
      const stage = wfStepLabels[wfStep] || wfStep;
      totalSeconds += seconds;

      // Look up individual work-time records for this step (finalized only)
      const finalized = allWorkTimes.filter((wt) => wt.wf_step === wfStep && wt.seconds > 0);

      if (finalized.length > 0) {
        const byPerson: Record<string, number> = {};
        for (const wt of finalized) {
          const email = wt.email || "Unassigned";
          byPerson[email] = (byPerson[email] || 0) + wt.seconds;
        }

        const people = Object.entries(byPerson).map(([email, sec]) => ({
          who: email,
          seconds: sec,
        }));

        steps.push({
          stage,
          performedBy: people[0].who,
          seconds,
          people: people.length > 1 ? people : undefined,
        });
      } else {
        steps.push({
          stage,
          performedBy: entry.assigned_to_email || "Unassigned",
          seconds,
        });
      }
    }
  }

  // 2. Unsubmitted (open) sessions from entry_work_times with 0 seconds
  const unsubmitted = allWorkTimes.filter((wt) => wt.seconds === 0);
  if (unsubmitted.length > 0) {
    // Group by wf_step
    const byStep: Record<string, { emails: string[] }> = {};
    for (const wt of unsubmitted) {
      const stage = wfStepLabels[wt.wf_step] || wt.wf_step;
      if (!byStep[stage]) byStep[stage] = { emails: [] };
      const email = wt.email || "Unassigned";
      if (!byStep[stage].emails.includes(email)) byStep[stage].emails.push(email);
    }

    for (const [stage, info] of Object.entries(byStep)) {
      const people = info.emails.map((email) => ({ who: email, seconds: 0 }));
      // Check if a finalized step with the same stage already exists
      const existing = steps.find((s) => s.stage === stage);
      if (existing) {
        // Merge unsubmitted people into the existing step
        const current = existing.people ?? [{ who: existing.performedBy, seconds: existing.seconds }];
        const merged = [...current];
        for (const p of people) {
          if (!merged.some((m) => m.who === p.who)) merged.push(p);
        }
        existing.people = merged;
      } else {
        steps.push({
          stage,
          performedBy: people[0].who,
          seconds: 0,
          people: people.length > 1 ? people : undefined,
        });
      }
    }
  }

  // Sort steps in workflow order
  steps.sort((a, b) => {
    const ai = entryWorkflowSteps.findIndex((s) => s.label === a.stage);
    const bi = entryWorkflowSteps.findIndex((s) => s.label === b.stage);
    return (ai >= 0 ? ai : 99) - (bi >= 0 ? bi : 99);
  });

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
      headerComponent: TotalTimeSpentHeaderCell,
    },
  };
}
