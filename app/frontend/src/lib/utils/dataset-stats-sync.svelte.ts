export interface DatasetStatsSyncContext {
  start: () => void;
}

export const datasetStatsSyncContext = Symbol("dataset-stats-sync");

/**
 * Delay before the next `syncing_stats` poll. Most sweeps finish in seconds, so
 * poll fast at first and back off for long ones. The server decides when a sync
 * is over (it also expires a dead sweep), so there is no client-side cap.
 */
export function statsSyncPollDelay(elapsedMs: number): number {
  if (elapsedMs < 30_000) return 1_000;
  if (elapsedMs < 120_000) return 5_000;
  return 15_000;
}
