/**
 * Format a duration in seconds into a human-readable string (h:mm:ss or m:ss).
 *
 * - < 1 min: "0:XX"
 * - < 1 hour: "m:ss"
 * - ≥ 1 hour: "h:mm:ss"
 *
 * Pure logic — no dependencies, unit-testable.
 */
export function formatDuration(totalSeconds: number): string {
  const total = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;

  const pad = (n: number) => String(n).padStart(2, "0");

  if (hours > 0) {
    return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${minutes}:${pad(seconds)}`;
}
