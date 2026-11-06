import {
  completionBounds,
  initialCompletionRange,
  viewerTimeZone,
  type DashboardRange,
  type CompletionTrend,
} from "./DashboardHistory";
import { SvelteDate, SvelteSet } from "svelte/reactivity";
import {
  createProjectDashboardDataSources,
  isAccessError,
  type ProjectDashboardDataSources,
  type Counts,
} from "@/components/app/projects/dashboard/DashboardData";
import { DatasetRecord } from "@/data/model/dataset/dataset-record";

import type { CollectionResponse } from "@/data/model/types";

export class DashboardManager {
  ids: string[] = $state([]);
  focused: DatasetRecord | null = $state(null);
  summary: Counts | null = $state(null);
  attention: number | null = $state(null);
  loading = $state(false);
  error = $state("");
  denied = $state(false);
  updated: Date | null = $state(null);
  version = $state(0);
  tableEpoch = $state(0);
  poolCount: number | null = $state(null);
  projectDatasetCount: number | null = $state(null);
  navigationPage: number | null = $state(0);
  poolMore = $state(false);
  trendRange: DashboardRange = $state(initialCompletionRange());
  trend: CompletionTrend = $state.raw({
    status: "idle",
    daily: {},
    loaded: 0,
    error: "",
    zone: viewerTimeZone(),
  });
  private trendGeneration = 0;
  private scopeReady = false;
  private generation = 0;
  private disposed = false;
  private reportingDay: Date | null = null;
  sources: ProjectDashboardDataSources = $state.raw(null!);
  constructor(
    readonly projectId: string,
    private readonly onScopeChange?: () => void,
  ) {
    this.replaceSources();
  }
  private replaceSources(): void {
    this.sources?.retire();
    this.sources = createProjectDashboardDataSources(this.projectId, (error) => {
      this.error =
        error.status === 404
          ? "This Project or Dataset is no longer available."
          : "Dashboard access is no longer available.";
      this.denyAccess();
    });
  }
  private clearMetrics(): void {
    this.summary = null;
    this.attention = null;
    this.updated = null;
  }
  private invalidateTrend(status: CompletionTrend["status"] = "loading"): void {
    this.trendGeneration++;
    this.trend = {
      status,
      daily: {},
      loaded: 0,
      error: "",
      zone: viewerTimeZone(),
    };
  }
  async applyTrendRange(range: DashboardRange): Promise<void> {
    completionBounds(range, viewerTimeZone());
    this.trendRange = { start: range.start, end: range.end };
    this.invalidateTrend();
    if (this.scopeReady) await this.loadTrend();
  }
  async retryTrend(): Promise<void> {
    if (!this.scopeReady) await this.refresh();
    else await this.loadTrend();
  }
  async loadTrend(): Promise<void> {
    if (this.disposed || this.denied || !this.scopeReady) return;
    this.invalidateTrend();
    const token = this.trendGeneration;
    const sources = this.sources;
    const ids = this.focused ? [this.focused.id] : [...this.ids];
    const range = { ...this.trendRange };
    const zone = this.trend.zone;
    const current = (): boolean => token === this.trendGeneration && !this.disposed && !this.denied;
    await sources
      .completionTrend(ids, range, zone, current, (daily, loaded): void => {
        if (current()) this.trend = { ...this.trend, daily, loaded };
      })
      .then((): void => {
        if (current()) this.trend = { ...this.trend, status: this.trend.loaded ? "ready" : "empty" };
      })
      .catch((error: unknown): void => {
        if (current())
          this.trend = {
            ...this.trend,
            status: this.trend.loaded ? "partial" : "unavailable",
            error: error instanceof Error ? error.message : "Completion results unavailable",
          };
      });
  }

  async load(): Promise<void> {
    if (this.disposed) return;
    const generation = ++this.generation;
    this.loading = true;
    this.error = "";
    try {
      const ids = this.focused ? [this.focused.id] : this.ids;
      const reportingDay = this.reportingDay;
      const [summary, attention] = await Promise.allSettled([
        this.sources.counts(ids),
        this.sources.attention(ids, reportingDay ?? new SvelteDate()),
      ]);
      if (generation !== this.generation) return;
      if (this.reportingDay === reportingDay)
        this.attention = attention.status === "fulfilled" ? attention.value : null;
      this.summary = summary.status === "fulfilled" ? summary.value : null;
      this.updated = summary.status === "fulfilled" ? new SvelteDate() : null;
      if (summary.status === "rejected")
        this.error = summary.reason instanceof Error ? summary.reason.message : "Dashboard counts unavailable";
    } catch (error) {
      if (generation === this.generation)
        this.error = error instanceof Error ? error.message : "Dashboard data unavailable";
    } finally {
      if (generation === this.generation) this.loading = false;
    }
  }
  async updateReportingDay(day: Date): Promise<void> {
    if (this.disposed) return;
    if (viewerTimeZone() !== this.trend.zone && this.scopeReady && !this.denied) void this.loadTrend();
    if (this.reportingDay?.getTime() === day.getTime()) return;
    const initialized = this.reportingDay !== null;
    this.reportingDay = day;
    if (!initialized || this.denied) return;
    const generation = this.generation;
    this.attention = null;
    try {
      const attention = await this.sources.attention(this.focused ? [this.focused.id] : this.ids, day);
      if (generation === this.generation && this.reportingDay === day) this.attention = attention;
    } catch {
      // Ordinary access failures are handled by the existing datasource callback.
      if (generation === this.generation && this.reportingDay === day) this.attention = null;
    }
  }
  private listDatasetPage(page: number, ids = this.ids): Promise<CollectionResponse<DatasetRecord>> {
    return this.sources.datasets.list({
      filters: ids.length ? { id: ids } : {},
      sort: ["name", "id"],
      pagination: { page, itemsPerPage: 1 },
      count: true,
    });
  }
  async select(ids: string[]): Promise<void> {
    if (this.disposed) return;
    if (ids.length > 100) {
      this.error = "Select up to 100 datasets.";
      return;
    }
    this.invalidateTrend();
    this.scopeReady = false;
    this.onScopeChange?.();
    this.tableEpoch++;
    this.denied = false;
    const token = ++this.generation;
    this.clearMetrics();
    this.loading = true;
    this.ids = [...new SvelteSet(ids)].sort();
    this.poolCount = null;
    this.poolMore = false;
    this.focused = null;
    this.replaceSources();
    try {
      const first = await this.listDatasetPage(1);
      if (token !== this.generation) return;
      this.poolCount = first.meta?.count ?? 0;
      this.poolMore = first.meta?.more === true;
      if (!this.ids.length) this.projectDatasetCount = this.poolMore ? null : this.poolCount;
      this.navigationPage = this.poolCount === 1 ? 1 : 0;
      if (this.poolCount === 1) {
        this.focused = first.data[0] ?? null;
      }
      this.scopeReady = true;
      void this.loadTrend();
      await this.load();
    } catch (error) {
      if (token === this.generation) {
        this.loading = false;
        if (!isAccessError(error)) {
          this.error = "Unable to load selected datasets";
          this.trend = {
            ...this.trend,
            status: "unavailable",
            error: this.error,
          };
        }
      }
    }
  }
  async focus(dataset: DatasetRecord | null, page: number | null = null): Promise<void> {
    if (this.disposed) return;
    this.invalidateTrend();
    this.scopeReady = false;
    this.onScopeChange?.();
    this.tableEpoch++;
    this.clearMetrics();
    this.focused = dataset;
    this.navigationPage = dataset ? page : 0;
    this.replaceSources();
    this.scopeReady = true;
    void this.loadTrend();
    await this.load();
  }
  async refresh(): Promise<void> {
    if (this.disposed) return;
    this.invalidateTrend();
    this.scopeReady = false;
    if (this.denied) {
      this.denied = false;
      this.replaceSources();
    }
    this.version++;
    const token = this.generation;
    this.loading = true;
    this.error = "";
    try {
      const [pool, project] = await Promise.all([
        this.listDatasetPage(1),
        this.ids.length
          ? this.listDatasetPage(1, []).catch((error: unknown) => {
              if (isAccessError(error)) throw error;
              return null;
            })
          : Promise.resolve(null),
      ]);
      if (token !== this.generation) return;
      this.poolCount = pool.meta?.count ?? 0;
      this.poolMore = pool.meta?.more === true;
      const projectMeta = this.ids.length ? project?.meta : pool.meta;
      this.projectDatasetCount = projectMeta && !projectMeta.more ? (projectMeta.count ?? null) : null;
      if (this.focused) {
        const current = await this.sources.datasets.list({
          filters: { id: [this.focused.id] },
          pagination: { page: 1, itemsPerPage: 1 },
          count: true,
        });
        if (token !== this.generation) return;
        if (!current.data[0]) throw new Error("Selected Dataset is unavailable");
        this.focused = current.data[0];
        this.navigationPage = null;
      }
      this.scopeReady = true;
      void this.loadTrend();
      await this.load();
    } catch (error) {
      if (token === this.generation) {
        this.error = error instanceof Error ? error.message : "Dashboard refresh failed";
        this.trend = {
          ...this.trend,
          status: "unavailable",
          error: this.error,
        };
      }
    } finally {
      if (token === this.generation) this.loading = false;
    }
  }

  async step(delta: number): Promise<void> {
    if (this.disposed || this.loading) return;
    if (this.ids.length === 1) return;
    const count = this.poolCount;
    if (!count) return;
    // Overview enters at the first/last Dataset. Detail navigation cycles without an overview stop.
    let page: number;
    if (!this.focused || this.navigationPage === null) {
      page = delta < 0 && !this.poolMore ? count : 1;
    } else {
      page = this.navigationPage + delta;
    }
    if (page < 1) page = this.poolMore ? 1 : count;
    if (!this.poolMore && page > count) page = 1;
    this.invalidateTrend();
    this.scopeReady = false;
    const generation = this.generation;
    this.loading = true;
    try {
      const result = await this.listDatasetPage(page);
      if (generation !== this.generation) return;
      if (result.data[0]) await this.focus(result.data[0], page);
      else if (page > 1) {
        const first = await this.listDatasetPage(1);
        if (generation !== this.generation) return;
        if (!first.data[0]) throw new Error("No Dataset is available in this scope");
        await this.focus(first.data[0], 1);
      } else {
        throw new Error("No Dataset is available in this scope");
      }
    } catch (error) {
      if (generation === this.generation) {
        this.error = error instanceof Error ? error.message : "Dataset navigation unavailable";
        this.trend = {
          ...this.trend,
          status: "unavailable",
          error: this.error,
        };
      }
    } finally {
      if (generation === this.generation) this.loading = false;
    }
  }
  denyAccess(): void {
    this.invalidateTrend("unavailable");
    this.scopeReady = false;
    this.generation++;
    this.clearMetrics();
    this.loading = false;
    this.denied = true;
    this.projectDatasetCount = null;
    this.poolCount = null;
    this.sources.retire();
  }
  dispose(): void {
    this.disposed = true;
    this.denyAccess();
  }
}
