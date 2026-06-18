import type { IIdahDriverV2, IStatEntry, IStatProvider, IStatsDriverV2 } from "../../types";
import { computeCoreStats } from "../stats/core-stats";

// ---------------------------------------------------------------------------
// Adapter: stats driver → IStatsDriverV2
//
// Produces the built-in core stats from the driver and merges in any stats
// contributed by registered providers (e.g. the active plugin).
// ---------------------------------------------------------------------------
export class StatsDriverAdapter implements IStatsDriverV2 {
  private providers: IStatProvider[] = [];

  constructor(private driver: IIdahDriverV2) {}

  register(provider: IStatProvider): void {
    this.providers.push(provider);
  }

  async collect(): Promise<IStatEntry[]> {
    // Core stats always survive; a failing plugin provider is logged and skipped
    // (mirrors the backend EntryStats::Recompute, which never lets a plugin
    // generator failure drop core stats).
    const stats = await computeCoreStats(this.driver);

    const results = await Promise.allSettled(this.providers.map((p) => p.collect()));
    for (const result of results) {
      if (result.status === "fulfilled") stats.push(...result.value);
      else console.error("[stats] provider failed to collect", result.reason);
    }

    return stats;
  }
}
