import { EntryRecord } from "@/data/model/dataset/entries/record";

export const PROJECT_DASHBOARD_WORKFLOW_GROUPS = [
  { key: "completed", label: "Completed", bgColor: "bg-green-600", badgeColor: "success" },
  { key: "reviewing", label: "Reviewing", bgColor: "bg-blue-500", badgeColor: "default" },
  { key: "pendingReview", label: "Pending review", bgColor: "bg-blue-200", badgeColor: "info" },
  { key: "annotating", label: "Annotating", bgColor: "bg-amber-500", badgeColor: "orange" },
  { key: "pendingAnnotation", label: "Pending annotation", bgColor: "bg-amber-200", badgeColor: "warning" },
  { key: "notReady", label: "Not Ready", bgColor: "bg-gray-200", badgeColor: "gray" },
  { key: "errored", label: "Error", bgColor: "bg-destructive", badgeColor: "destructive" },
] as const;

export const COMPLETION_GROUPINGS = ["Day", "Week", "Month"] as const;

export const PROJECT_DASHBOARD_OPEN_ENTRIES_TABS = [
  { label: "All", value: "all" },
  { label: "Open", value: "open" },
  { label: "Error", value: "error" },
  { label: "Not Ready", value: "not_ready" },
  { label: "Completed", value: "completed" },
] as const;

export function getEntryWorkflowGroup(
  entry: Pick<EntryRecord, "status" | "wf_step">,
): (typeof PROJECT_DASHBOARD_WORKFLOW_GROUPS)[number] | undefined {
  const { status, wf_step } = entry;
  let key = status === "completed" ? "completed" : status === "errored" ? "errored" : undefined;

  if (status === "processing") key = "notReady";
  else if (status === "pending") {
    if (wf_step === "review") key = "pendingReview";
    else if (wf_step === "annotate") key = "pendingAnnotation";
  } else if (status === "in_progress") {
    if (wf_step === "review") key = "reviewing";
    else if (wf_step === "annotate") key = "annotating";
  }
  return PROJECT_DASHBOARD_WORKFLOW_GROUPS.find((group) => group.key === key);
}
