import type { EntryStatRecord } from "@/data/model/dataset/entry-stats/record";

export function orphanCountsByEntry(entryIds: string[], stats: EntryStatRecord[]): Record<string, number> {
  const counts = Object.fromEntries(entryIds.map((id) => [id, 0]));
  for (const stat of stats) counts[stat.entry_id] = Number(stat.value ?? 0);
  return counts;
}
