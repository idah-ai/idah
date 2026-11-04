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
  poolCount = $state(0);
  navigationPage: number | null = $state(0);
  poolMore = $state(false);
  private generation = 0;
  private disposed = false;
  private reportingDay: Date | null = null;
  sources: ProjectDashboardDataSources = $state.raw(null!);
  constructor(readonly projectId: string) {
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
      this.version++;
    } catch (error) {
      if (generation === this.generation)
        this.error = error instanceof Error ? error.message : "Dashboard data unavailable";
    } finally {
      if (generation === this.generation) this.loading = false;
    }
  }
  async updateReportingDay(day: Date): Promise<void> {
    if (this.disposed || this.reportingDay?.getTime() === day.getTime()) return;
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
  private listDatasetPage(page: number): Promise<CollectionResponse<DatasetRecord>> {
    return this.sources.datasets.list({
      filters: this.ids.length ? { id: this.ids } : {},
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
    this.tableEpoch++;
    this.denied = false;
    const token = ++this.generation;
    this.clearMetrics();
    this.loading = true;
    this.ids = [...new SvelteSet(ids)].sort();
    this.focused = null;
    this.replaceSources();
    try {
      const first = await this.listDatasetPage(1);
      if (token !== this.generation) return;
      this.poolCount = first.meta?.count ?? 0;
      this.poolMore = first.meta?.more === true;
      this.navigationPage = this.poolCount === 1 ? 1 : 0;
      if (this.poolCount === 1) {
        this.focused = first.data[0] ?? null;
      }
      await this.load();
    } catch (error) {
      if (token === this.generation) {
        this.loading = false;
        if (!isAccessError(error)) this.error = "Unable to load selected datasets";
      }
    }
  }
  async focus(dataset: DatasetRecord | null, page: number | null = null): Promise<void> {
    if (this.disposed) return;
    this.tableEpoch++;
    this.clearMetrics();
    this.focused = dataset;
    this.navigationPage = dataset ? page : 0;
    this.replaceSources();
    await this.load();
  }
  async refresh(): Promise<void> {
    if (this.disposed) return;
    if (this.denied) {
      this.denied = false;
      this.replaceSources();
    }
    const token = this.generation;
    this.loading = true;
    this.error = "";
    try {
      const pool = await this.listDatasetPage(1);
      if (token !== this.generation) return;
      this.poolCount = pool.meta?.count ?? 0;
      this.poolMore = pool.meta?.more === true;
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
      await this.load();
    } catch (error) {
      if (token === this.generation) this.error = error instanceof Error ? error.message : "Dashboard refresh failed";
    } finally {
      if (token === this.generation) this.loading = false;
    }
  }

  async step(delta: number): Promise<void> {
    if (this.disposed || this.loading) return;
    if (this.ids.length === 1) return;
    if (!this.poolCount) return;
    // Overview enters at the first/last Dataset. Detail navigation cycles without an overview stop.
    let page: number;
    if (!this.focused || this.navigationPage === null) {
      page = delta < 0 && !this.poolMore ? this.poolCount : 1;
    } else {
      page = this.navigationPage + delta;
    }
    if (page < 1) page = this.poolMore ? 1 : this.poolCount;
    if (!this.poolMore && page > this.poolCount) page = 1;
    const generation = this.generation;
    this.loading = true;
    try {
      const result = await this.listDatasetPage(page);
      if (generation !== this.generation) return;
      if (result.data[0]) await this.focus(result.data[0], page);
      else if (page > 1) {
        const first = await this.listDatasetPage(1);
        if (generation === this.generation && first.data[0]) await this.focus(first.data[0], 1);
      }
    } catch (error) {
      if (generation === this.generation)
        this.error = error instanceof Error ? error.message : "Dataset navigation unavailable";
    } finally {
      if (generation === this.generation) this.loading = false;
    }
  }
  denyAccess(): void {
    this.generation++;
    this.clearMetrics();
    this.loading = false;
    this.denied = true;
    this.sources.retire();
  }
  dispose(): void {
    this.disposed = true;
    this.denyAccess();
  }
}
