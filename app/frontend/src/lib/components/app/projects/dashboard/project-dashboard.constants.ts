export const PROJECT_DASHBOARD_WORKFLOW_GROUPS = [
  { key: "completed", label: "Completed", bgColor: "bg-emerald-500" },
  { key: "reviewing", label: "Reviewing", bgColor: "bg-blue-500" },
  { key: "pendingReview", label: "Pending review", bgColor: "bg-blue-200" },
  { key: "annotating", label: "Annotating", bgColor: "bg-amber-500" },
  { key: "pendingAnnotation", label: "Pending annotation", bgColor: "bg-amber-200" },
] as const;

export const COMPLETION_GROUPINGS = ["Day", "Week", "Month"] as const;
