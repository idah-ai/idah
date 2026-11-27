import { intervalToDuration } from "date-fns";

/**
 * Format a duration in seconds into a human-readable string (h:mm:ss or m:ss).
 *
 * - < 1 min: "0:XX"
 * - < 1 hour: "m:ss"
 * - ≥ 1 hour: "h:mm:ss"
 */
export function formatDuration(totalSeconds: number): string {
  const total = Math.max(0, Math.round(totalSeconds));
  const duration = intervalToDuration({ start: 0, end: total * 1000 });
  const h = (duration.days || 0) * 24 + (duration.hours || 0);
  const m = duration.minutes || 0;
  const s = duration.seconds || 0;

  const pad = (n: number) => String(n).padStart(2, "0");

  if (h > 0) {
    return `${h}:${pad(m)}:${pad(s)}`;
  }
  return `${m}:${pad(s)}`;
}

/**
 * Format a duration in seconds into padded hh:mm:ss.
 *
 * - 0       → "—"
 * - 45      → "00:00:45"
 * - 3661    → "01:01:01"
 */
export function formatSeconds(totalSeconds: number): string {
  if (totalSeconds <= 0) return "—";
  const duration = intervalToDuration({ start: 0, end: totalSeconds * 1000 });
  const h = (duration.days || 0) * 24 + (duration.hours || 0);
  const m = duration.minutes || 0;
  const s = duration.seconds || 0;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
