import { EntryRecord } from "@/data/model/dataset/entries/record";

export const PROJECT_DASHBOARD_WORKFLOW_GROUPS = [
  { key: "completed", label: "Completed", bgColor: "bg-emerald-500", badgeColor: "success" },
  { key: "reviewing", label: "Reviewing", bgColor: "bg-blue-500", badgeColor: "default" },
  { key: "pendingReview", label: "Pending review", bgColor: "bg-blue-200", badgeColor: "info" },
  { key: "annotating", label: "Annotating", bgColor: "bg-amber-500", badgeColor: "orange" },
  { key: "pendingAnnotation", label: "Pending annotation", bgColor: "bg-amber-200", badgeColor: "warning" },
] as const;

export const COMPLETION_GROUPINGS = ["Day", "Week", "Month"] as const;

export const PROJECT_DASHBOARD_OPEN_ENTRIES_TABS = [
  {
    label: "All",
    value: "all",
  },
  {
    label: "Open",
    value: "open",
  },
  {
    label: "Completed",
    value: "completed",
  },
] as const;

export function getEntryWorkflowGroup(
  entry: Pick<EntryRecord, "status" | "wf_step" | "assigned_to_id">,
): (typeof PROJECT_DASHBOARD_WORKFLOW_GROUPS)[number] | undefined {
  const { status, wf_step, assigned_to_id } = entry;
  let key = status === "completed" ? "completed" : undefined;

  if (status === "pending" || status === "in_progress") {
    if (wf_step === "review") key = assigned_to_id != null ? "reviewing" : "pendingReview";
    else if (wf_step === "annotate") key = assigned_to_id != null ? "annotating" : "pendingAnnotation";
  }
  return PROJECT_DASHBOARD_WORKFLOW_GROUPS.find((group) => group.key === key);
}
