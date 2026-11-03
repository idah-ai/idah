import { SvelteSet } from "svelte/reactivity";

export interface DatasetStatsSyncContext {
  start: () => void;
  isChecking: () => boolean;
}

export const datasetStatsSyncContext = Symbol("dataset-stats-sync");

export type StatsSyncState = "idle" | "waiting" | "running" | "unverified";

/** A false read before the backend sweep starts is not completion. */
export function nextStatsSyncState(
  state: "waiting" | "running",
  syncing: boolean | undefined,
  elapsedMs: number,
): "waiting" | "running" | "complete" | "unverified" {
  if (syncing === true) return "running";
  if (state === "running" && syncing === false) return "complete";
  if (state === "waiting" && elapsedMs >= 10_000) return "unverified";
  return state;
}

type CategoryConfig = Record<string, { values?: { id: string; label?: string }[] }>;

export function categoryIdsChanged(before: CategoryConfig, after: CategoryConfig): boolean {
  const ids = (config: CategoryConfig) =>
    new SvelteSet(Object.values(config).flatMap((shape) => (shape.values ?? []).map((value) => value.id)));
  const oldIds = ids(before);
  const newIds = ids(after);
  return oldIds.size !== newIds.size || [...oldIds].some((id) => !newIds.has(id));
}
