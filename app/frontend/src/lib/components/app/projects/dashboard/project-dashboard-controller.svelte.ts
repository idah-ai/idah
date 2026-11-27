import { getContext, setContext } from "svelte";
import { SvelteSet } from "svelte/reactivity";
import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  format,
  isAfter,
  isBefore,
  isSameDay,
  isSameMonth,
  isSameYear,
  isValid,
  isWithinInterval,
  max,
  min,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subDays,
} from "date-fns";
import { get, type Unsubscriber } from "svelte/store";

import { DatasetRecord, datasetsBackendDataSource } from "@/data/model/dataset/dataset-record";
import { EntryRecord, entriesBackendDataSource } from "@/data/model/dataset/entries/record";
import { ProjectMemberRecord } from "@/data/model/dataset/projects/members/record";
import { getDeliveryStatusBadge, today } from "@/utils/date";
import { PROJECT_DASHBOARD_WORKFLOW_GROUPS } from "@/components/app/projects/dashboard/project-dashboard.constants";

import type { DatasetDeliveryBreakdown } from "@/data/model/dataset/datasets/constants";
import type { IDataTablePagination } from "@/components/app/data-table/types";
import type { Pagination } from "@/data/DataSource";
import type { CollectionResponse } from "@/data/model/types";
import type {
  CompletionGrouping,
  CompletionRange,
  CompletionHistoryResult,
  CompletionBucket,
  OpenEntryTab,
} from "@/components/app/projects/dashboard/project-dashboard.types";
import type { EntrySummary } from "@/data/model/dataset/entries/constants";

export const PROJECT_DASHBOARD_CONTROLLER_KEY = Symbol("project-dashboard-controller");

export function setProjectDashboardController(key: symbol, controller: ProjectDashboardController): void {
  setContext<ProjectDashboardController>(key, controller);
}

export function getProjectDashboardController(key: symbol): ProjectDashboardController {
  const controller = getContext<ProjectDashboardController | undefined>(key);

  if (!controller) throw new Error("Project Dashboard controller is not available.");
  return controller;
}

export class ProjectDashboardController {
  // ==================== Lifecycle ====================

  private started = false;
  private disposed = false;
  private unsubscribeToday: Unsubscriber | undefined;

  constructor(public readonly projectId: string) {}

  async start(): Promise<void> {
    if (this.started || this.disposed) return;
    this.started = true;
    this.unsubscribeToday = today.subscribe((day) => {
      const changed = !isSameDay(day, this.reportingDay);
      this.reportingDay = day;

      if (this.scopeReady && !this.denied) {
        if (changed) void this.loadAttention();
        if (
          (changed && this.automaticCompletionRange) ||
          this.completionHistory.zone !== Intl.DateTimeFormat().resolvedOptions().timeZone
        )
          void this.loadCompletionHistory();
      }
    });
    await this.select([]);
  }

  dispose(): void {
    this.disposed = true;
    this.generation++;
    this.clearMetrics();
    this.clearCompletionHistory();
    this.clearDatasetProgress();
    this.clearEntryProgress();
    this.unsubscribeToday?.();
    this.unsubscribeToday = undefined;
  }

  // ==================== Shared Scope ====================

  public selectedDatasetIds: string[] = $state([]);
  public focused: DatasetRecord | null = $state.raw(null);
  public scopeReady = $state(false);
  public loading = $state(false);
  public error = $state("");
  public denied = $state(false);

  public get singleDatasetView(): boolean {
    return this.focused !== null || this.selectedDatasetIds.length === 1;
  }

  public get effectiveDatasetIds(): string[] {
    return this.focused ? [this.focused.id] : [...this.selectedDatasetIds];
  }

  // ==================== Dataset Selection ====================

  public selectedDatasets: DatasetRecord[] = $state.raw([]);

  async select(ids: string[]): Promise<void> {
    if (this.disposed) return;
    const selected = [...new SvelteSet(ids)].sort();
    if (selected.length > 100 || selected.some((id) => typeof id !== "string" || !id)) {
      this.error = "Select up to 100 datasets.";
      return;
    }
    this.clearMetrics();
    this.clearCompletionHistory();
    this.clearDatasetProgress();
    this.clearEntryProgress();
    this.entryOverviewPage = 1;
    this.selectedDatasetIds = selected;
    this.focused = null;
    this.selectedDatasets = [];

    if (selected.length === 0) {
      this.generation++;
      this.scopeReady = true;
      this.loading = false;
      this.error = "";
      this.denied = false;
      this.loadMetrics();
      return;
    }
    await this.loadSelectedDatasets();
  }

  // ==================== Dataset Navigation ====================

  public get showDatasetNavigation(): boolean {
    return this.selectedDatasetIds.length >= 1;
  }

  showAllDatasets(): void {
    if (this.disposed || this.denied || this.loading || !this.focused) return;
    this.generation++;
    this.focused = null;
    this.entryProgressPagination = { ...this.entryProgressPagination, page: this.entryOverviewPage };
    this.loadMetrics(false);
  }

  step(delta: -1 | 1): void {
    if (this.disposed || this.denied || this.loading || !this.scopeReady || !this.selectedDatasets.length) return;
    const records = this.selectedDatasets;
    if (!this.focused) {
      this.entryOverviewPage = this.entryProgressPagination.page;
      this.generation++;
      this.focused = delta === 1 ? records[0] : records[records.length - 1];
      this.loadMetrics(false);
      return;
    }
    const index = records.findIndex((record) => record.id === this.focused?.id);
    const next = records[(index + delta + records.length) % records.length];
    if (next.id === this.focused.id) return;
    this.generation++;
    this.focused = next;
    this.loadMetrics(false);
  }

  async retry(): Promise<void> {
    if (this.disposed || this.loading || !this.error || !this.selectedDatasetIds.length) return;
    await this.loadSelectedDatasets();
  }

  // ==================== Summary & Metrics ====================

  public summary: EntrySummary | null = $state.raw(null);
  public summaryLoading = $state(false);
  public summaryError = $state("");

  private get datasetTotal(): number | null {
    const records = this.focused
      ? [this.focused]
      : this.selectedDatasetIds.length > 0 && this.selectedDatasets.length === this.selectedDatasetIds.length
        ? this.selectedDatasets
        : null;
    if (!records) return null;

    let total = 0;
    for (const record of records) {
      if (!Number.isSafeInteger(record.entries_total_count) || record.entries_total_count < 0) return null;
      total += record.entries_total_count;
      if (!Number.isSafeInteger(total)) return null;
    }
    return total;
  }

  public get totalEntries(): number | null {
    return this.scopeReady && !this.denied
      ? (this.summary?.total ?? (this.summaryLoading ? this.datasetTotal : null))
      : null;
  }

  public get progress(): number | null {
    return this.summary
      ? this.summary.total
        ? Math.round((this.summary.completed / this.summary.total) * 100)
        : 0
      : null;
  }

  public get openEntriesCount(): number | null {
    return this.summary?.open ?? null;
  }

  public get openEntriesDescription(): string {
    if (this.summaryLoading) return "";
    const summary = this.summary;
    if (!summary) return "Workflow breakdown unavailable";
    const parts = [
      `${summary.review.toLocaleString()} In review`,
      `${summary.annotation.toLocaleString()} In annotation`,
    ];

    return parts.join(" · ");
  }

  public get datasetCaption(): string {
    if (this.focused) return "in this dataset";
    const count = this.selectedDatasetIds.length;
    return count ? `across ${count} selected dataset${count === 1 ? "" : "s"}` : "across all datasets";
  }

  public get focusedDeliveryLabel(): string | null {
    if (!this.focused || !this.summary) return null;
    const completed =
      this.focused.status === "completed" || (this.summary.total > 0 && this.summary.completed === this.summary.total);
    return getDeliveryStatusBadge(this.focused.delivery_date, completed, this.reportingDay).label;
  }

  private clearMetrics(): void {
    this.summary = null;
    this.summaryLoading = false;
    this.summaryError = "";
    this.attentionBreakdown = null;
    this.attentionLoading = false;
    this.attentionError = "";
  }

  private loadMetrics(resetOverviewPages = true): void {
    if (this.disposed || this.denied || !this.scopeReady) return;
    this.clearMetrics();
    void this.loadSummary();
    void this.loadAttention();
    void this.loadCompletionHistory();
    void this.loadDatasetProgress(resetOverviewPages);
    void this.loadEntryProgress(resetOverviewPages || this.focused !== null);
  }

  async retrySummary(): Promise<void> {
    if (this.disposed || this.denied || !this.scopeReady || this.summaryLoading) return;
    await this.loadSummary();
  }

  private async loadSummary(): Promise<void> {
    const scope = this.generation;
    const ids = this.effectiveDatasetIds;
    const current = (): boolean => this.isCurrent(scope);
    this.summary = null;
    this.summaryLoading = true;
    this.summaryError = "";
    try {
      const summary = await entriesBackendDataSource.summary(this.projectId, ids);
      if (!current()) return;
      const counts = [
        summary.total,
        summary.completed,
        summary.errored,
        summary.processing,
        summary.pending_annotation,
        summary.pending_review,
        summary.open,
        summary.review,
        summary.annotation,
      ];
      if (
        counts.some((count) => !Number.isSafeInteger(count) || count < 0) ||
        summary.completed + summary.errored + summary.processing + summary.open > summary.total ||
        summary.annotation + summary.review > summary.open ||
        summary.pending_annotation > summary.annotation ||
        summary.pending_review > summary.review
      ) {
        throw new Error("Dashboard counts are inconsistent. Please retry.");
      }
      this.summary = summary;
    } catch (reason) {
      if (!current() || this.handleAccessError(reason)) return;
      this.summaryError = reason instanceof Error ? reason.message : "Dashboard counts unavailable.";
    } finally {
      if (current()) this.summaryLoading = false;
    }
  }

  // ==================== Entries by Status ====================

  public get workflowDistribution(): {
    total: number;
    residual: number;
    groups: { label: string; value: number; bgColor: string }[];
  } | null {
    const summary = this.summary;
    if (!summary) return null;

    const values = {
      completed: summary.completed,
      reviewing: summary.review - summary.pending_review,
      pendingReview: summary.pending_review,
      annotating: summary.annotation - summary.pending_annotation,
      pendingAnnotation: summary.pending_annotation,
      notReady: summary.processing,
      errored: summary.errored,
    };
    const residual =
      summary.total - summary.completed - summary.errored - summary.processing - summary.annotation - summary.review;
    if (values.annotating < 0 || values.reviewing < 0 || residual < 0) return null;

    return {
      total: summary.total,
      residual,
      groups: PROJECT_DASHBOARD_WORKFLOW_GROUPS.map((group) => ({ ...group, value: values[group.key] })),
    };
  }

  // ==================== Attention & Local Reporting Day ====================

  public attentionBreakdown: DatasetDeliveryBreakdown | null = $state.raw(null);

  public get attention(): number | null {
    const breakdown = this.attentionBreakdown;
    return breakdown ? breakdown.overdue + breakdown.due_today + breakdown.due_tomorrow : null;
  }

  public get deliveryDescription(): string {
    if (this.focused) {
      const date = this.focused.formattedDeliveryDate;
      return date ? `Delivery date: ${date}` : "Delivery date not set";
    }
    if (this.attentionLoading) return "";

    const breakdown = this.attentionBreakdown;
    if (!breakdown) return "Delivery breakdown unavailable for this scope";

    const parts: string[] = [];
    if (breakdown.overdue) parts.push(`${breakdown.overdue.toLocaleString()} Overdue`);
    if (breakdown.due_today) parts.push(`${breakdown.due_today.toLocaleString()} Due today`);
    if (breakdown.due_tomorrow) parts.push(`${breakdown.due_tomorrow.toLocaleString()} Due tomorrow`);

    return parts.join(" · ") || "No overdue or upcoming delivery dates";
  }
  public attentionLoading = $state(false);
  public attentionError = $state("");
  public reportingDay: Date = $state.raw(get(today));
  private attentionGeneration = 0;

  async retryAttention(): Promise<void> {
    if (this.disposed || this.denied || !this.scopeReady || this.attentionLoading || this.focused) return;
    await this.loadAttention();
  }

  private async loadAttention(): Promise<void> {
    if (this.disposed || this.denied || !this.scopeReady) return;

    const scope = this.generation;
    const request = ++this.attentionGeneration;
    const day = this.reportingDay;
    const current = (): boolean => this.isCurrent(scope) && request === this.attentionGeneration;
    this.attentionBreakdown = null;
    this.attentionError = "";
    this.attentionLoading = true;
    try {
      if (this.focused) return;
      const result = await datasetsBackendDataSource.deliveryBreakdown(
        this.projectId,
        this.effectiveDatasetIds,
        format(day, "yyyy-MM-dd"),
      );
      if (!current()) return;
      this.attentionBreakdown = result;
    } catch (reason) {
      if (!current() || this.handleAccessError(reason)) return;
      this.attentionError = reason instanceof Error ? reason.message : "Delivery breakdown unavailable for this scope.";
    } finally {
      if (current()) this.attentionLoading = false;
    }
  }

  // ==================== Completion History ====================

  public completionRange: CompletionRange = $state.raw({
    start: format(addDays(this.reportingDay, -6), "yyyy-MM-dd"),
    end: format(this.reportingDay, "yyyy-MM-dd"),
  });
  public completionGrouping: CompletionGrouping = $state("Day");
  public completionHistory: CompletionHistoryResult = $state.raw({
    status: "idle",
    daily: {},
    zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    error: "",
  });
  private completionGeneration = 0;
  private automaticCompletionRange = true;

  public get completionToday(): string {
    return format(this.reportingDay, "yyyy-MM-dd");
  }

  public get completionTotal(): number {
    return Object.values(this.completionHistory.daily).reduce((sum, count) => sum + count, 0);
  }

  public get completionMaximum(): number {
    return this.completionBuckets.reduce((maximum, bucket) => Math.max(maximum, bucket.count ?? 0), 1);
  }

  private completionDateLabel(value: string): string {
    return format(parseISO(value), "d MMM yyyy");
  }

  public isCompletionRangeValid(range: CompletionRange): boolean {
    const isValidDate = (value: string): boolean => {
      const date = parseISO(value);
      return isValid(date) && format(date, "yyyy-MM-dd") === value;
    };

    return (
      isValidDate(range.start) &&
      isValidDate(range.end) &&
      differenceInCalendarDays(parseISO(range.end), parseISO(range.start)) < 366 &&
      !isAfter(parseISO(range.start), parseISO(range.end)) &&
      !isAfter(parseISO(range.end), this.reportingDay)
    );
  }

  public setCompletionGrouping(grouping: CompletionGrouping): void {
    this.completionGrouping = grouping;
  }

  public async applyCompletionRange(range: CompletionRange): Promise<void> {
    if (this.disposed || this.denied || !this.isCompletionRangeValid(range)) return;
    this.automaticCompletionRange = false;
    this.completionRange = { ...range };
    this.clearCompletionHistory();
    if (this.scopeReady) await this.loadCompletionHistory();
  }

  public async retryCompletionHistory(): Promise<void> {
    if (this.disposed || this.denied || this.completionHistory.status === "loading") return;
    if (this.scopeReady) await this.loadCompletionHistory();
    else await this.retry();
  }

  private completionPeriodStart(date: Date): Date {
    if (this.completionGrouping === "Week") return startOfWeek(date, { weekStartsOn: 1 });
    if (this.completionGrouping === "Month") return startOfMonth(date);
    return startOfDay(date);
  }

  public get completionBuckets(): CompletionBucket[] {
    const range = this.completionRange;
    const grouping = this.completionGrouping;
    const complete = this.completionHistory.status === "ready" || this.completionHistory.status === "empty";

    const rangeStart = parseISO(range.start);
    const rangeEnd = parseISO(range.end);
    const today = parseISO(this.completionToday);

    const totals: Record<string, number> = {};

    for (const [day, count] of Object.entries(this.completionHistory.daily)) {
      const key = format(this.completionPeriodStart(parseISO(day)), "yyyy-MM-dd");
      totals[key] = (totals[key] ?? 0) + count;
    }

    const result: CompletionBucket[] = [];
    const currentPeriod = this.completionPeriodStart(this.reportingDay);

    let current = this.completionPeriodStart(rangeStart);

    while (!isAfter(current, rangeEnd)) {
      const key = format(current, "yyyy-MM-dd");

      const next = grouping === "Month" ? addMonths(current, 1) : addDays(current, grouping === "Week" ? 7 : 1);

      const periodEnd = subDays(next, 1);
      const start = max([current, rangeStart]);
      const end = min([periodEnd, rangeEnd]);

      const startDate = format(start, "yyyy-MM-dd");
      const endDate = format(end, "yyyy-MM-dd");

      let axisLabel: string;

      if (grouping === "Month") {
        axisLabel = format(start, "MMM yyyy");
      } else if (grouping === "Day" || isSameDay(start, end)) {
        axisLabel = format(start, "d MMM");
      } else if (isSameMonth(start, end)) {
        axisLabel = `${format(start, "d")}–${format(end, "d MMM")}`;
      } else if (isSameYear(start, end)) {
        axisLabel = `${format(start, "d MMM")}–${format(end, "d MMM")}`;
      } else {
        axisLabel = `${format(start, "d MMM yyyy")}–${format(end, "d MMM yyyy")}`;
      }

      result.push({
        key,
        start: startDate,
        end: endDate,
        count: totals[key] ?? (complete ? 0 : null),
        clipped: isBefore(current, rangeStart) || isAfter(periodEnd, rangeEnd),
        current:
          isSameDay(current, currentPeriod) &&
          isWithinInterval(today, { start: rangeStart, end: rangeEnd }) &&
          (this.completionHistory.daily[this.completionToday] ?? 0) > 0,
        label: isSameDay(start, end)
          ? this.completionDateLabel(startDate)
          : `${this.completionDateLabel(startDate)} – ${this.completionDateLabel(endDate)}`,
        axisLabel,
      });

      current = next;
    }

    return result;
  }

  private clearCompletionHistory(): void {
    this.completionGeneration++;
    this.completionHistory = {
      status: "idle",
      daily: {},
      zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      error: "",
    };
  }

  private async loadCompletionHistory(): Promise<void> {
    if (this.disposed || this.denied || !this.scopeReady) return;

    const scope = this.generation;
    const request = ++this.completionGeneration;
    const ids = this.effectiveDatasetIds;
    const range = { ...this.completionRange };
    const automatic = this.automaticCompletionRange;
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    const current = (): boolean =>
      this.isCurrent(scope) &&
      request === this.completionGeneration &&
      zone === Intl.DateTimeFormat().resolvedOptions().timeZone;

    this.completionHistory = { status: "loading", daily: {}, zone, error: "" };

    try {
      const result = await entriesBackendDataSource.completionHistory(
        this.projectId,
        ids,
        automatic ? { tz: zone } : { from: range.start, to: range.end, tz: zone },
      );
      if (!current()) return;
      if (automatic) this.completionRange = { start: result.from, end: result.to };
      this.completionHistory = {
        status: Object.keys(result.daily).length ? "ready" : "empty",
        daily: result.daily,
        zone,
        error: "",
      };
    } catch (reason) {
      if (!current() || this.handleAccessError(reason)) return;
      this.completionHistory = {
        status: "unavailable",
        daily: {},
        zone,
        error: reason instanceof Error ? reason.message : "Recorded completions are unavailable.",
      };
    }
  }

  // ==================== Progress by entry ====================

  public entryTab: OpenEntryTab = $state("all");

  /** Tab definitions with live counts derived from summary. */
  public get entryTabItems(): { label: string; value: string; count: number | null }[] {
    const s = this.summary;
    return [
      { label: "All", value: "all", count: s?.total ?? null },
      { label: "Open", value: "open", count: s != null ? s.total - s.completed - s.errored - s.processing : null },
      { label: "Not ready", value: "not_ready", count: s?.processing ?? null },
      { label: "Completed", value: "completed", count: s?.completed ?? null },
      { label: "Errored", value: "error", count: s?.errored ?? null },
    ];
  }

  changeEntryTab(value: string): void {
    if (value !== "all" && value !== "open" && value !== "not_ready" && value !== "completed" && value !== "error")
      return;
    if (value === this.entryTab || this.disposed || this.denied) return;
    this.entryOverviewPage = 1;
    this.entryTab = value;
    void this.loadEntryProgress(true);
  }

  sortTotalTimeSpent(): void {
    if (this.entryProgressSort[0] === "-total_time_spent") {
      this.entryProgressSort = ["total_time_spent", "-id"];
    } else {
      this.entryProgressSort = ["-total_time_spent", "-id"];
    }
    this.entryProgressPagination = { ...this.entryProgressPagination, page: 1 };
    void this.loadEntryProgress(true);
  }

  public entryProgressResponse: CollectionResponse<EntryRecord> | null = $state.raw(null);
  public entryProgressSort: string[] = $state([]);
  public entryProgressPagination: Pagination = $state.raw({ page: 1, itemsPerPage: 10 });
  public entryProgressLoading = $state(false);
  public entryProgressError = $state("");
  private entryProgressGeneration = 0;
  private entryOverviewPage = 1;

  public get entryProgressRows(): EntryRecord[] {
    return this.scopeReady && !this.denied && !this.disposed ? (this.entryProgressResponse?.data ?? []) : [];
  }

  public get entryProgressTablePagination(): IDataTablePagination | undefined {
    if (!this.scopeReady || this.denied || this.disposed) return undefined;
    const meta = this.entryProgressResponse?.meta;
    const count = meta?.count;
    if (typeof count !== "number" || !Number.isSafeInteger(count) || count < 0 || typeof meta?.more !== "boolean")
      return undefined;

    return { ...this.entryProgressPagination, count, hasMore: meta.more };
  }

  public get entryProgressCaption(): string {
    if (this.entryProgressLoading || this.entryProgressError || !this.scopeReady || this.denied) return "";
    const shown = this.entryProgressRows.length;
    if (shown === 0 && this.entryProgressPagination.page > 1)
      return `Showing 0 entries on page ${this.entryProgressPagination.page}`;

    const pagination = this.entryProgressTablePagination;
    if (pagination) {
      if (pagination.hasMore)
        return `Showing ${shown.toLocaleString()} entries · ${pagination.count.toLocaleString()}+ matching`;
      return `Showing ${shown.toLocaleString()} of ${pagination.count.toLocaleString()} entries`;
    }
    return `Showing ${shown.toLocaleString()} entries`;
  }

  async changeEntryProgressPage(pagination: Pagination): Promise<void> {
    if (this.disposed || this.denied || !this.scopeReady) return;
    if (
      !Number.isSafeInteger(pagination.page) ||
      pagination.page < 1 ||
      !Number.isSafeInteger(pagination.itemsPerPage) ||
      pagination.itemsPerPage < 1
    )
      return;
    const next = {
      page: pagination.itemsPerPage === this.entryProgressPagination.itemsPerPage ? pagination.page : 1,
      itemsPerPage: pagination.itemsPerPage,
    };
    if (
      next.page === this.entryProgressPagination.page &&
      next.itemsPerPage === this.entryProgressPagination.itemsPerPage
    )
      return;

    if (next.itemsPerPage !== this.entryProgressPagination.itemsPerPage) this.entryOverviewPage = 1;
    this.entryProgressPagination = next;
    await this.loadEntryProgress();
  }

  async retryEntryProgress(): Promise<void> {
    if (this.disposed || this.denied || this.loading || this.entryProgressLoading) return;
    if (this.scopeReady) await this.loadEntryProgress();
    else await this.retry();
  }

  private clearEntryProgress(): void {
    this.entryProgressGeneration++;
    this.entryProgressResponse = null;
    this.entryProgressLoading = false;
    this.entryProgressError = "";
  }

  private async loadEntryProgress(resetPage = false): Promise<void> {
    if (resetPage) this.entryProgressPagination = { ...this.entryProgressPagination, page: 1 };
    if (this.disposed || this.denied || !this.scopeReady) return;

    const scope = this.generation;
    const request = ++this.entryProgressGeneration;
    const current = (): boolean => this.isCurrent(scope) && request === this.entryProgressGeneration;
    const ids = this.effectiveDatasetIds;
    const overview = !this.singleDatasetView;
    // const overview = !this.focused;
    this.entryProgressResponse = null;
    this.entryProgressError = "";
    this.entryProgressLoading = true;
    try {
      if (!this.projectId || (this.selectedDatasetIds.length > 0 && ids.length === 0))
        throw new Error("Entry scope is unavailable. Please retry.");
      const statuses =
        this.entryTab === "error"
          ? ["errored"]
          : this.entryTab === "completed"
            ? ["completed"]
            : this.entryTab === "not_ready"
              ? ["processing"]
              : this.entryTab === "open"
                ? ["pending", "in_progress"]
                : null;
      const response = await entriesBackendDataSource.list({
        filters: {
          project_id: this.projectId,
          ...(ids.length ? { dataset_id: ids } : {}),
          ...(statuses ? { status__in: statuses } : {}),
        },
        fields: {
          [EntryRecord.type]: [
            "id",
            "name",
            "resource",
            "dataset_id",
            "status",
            "wf_step",
            "assigned_to_id",
            "assigned_to_email",
            "time_tracking",
          ],
          [ProjectMemberRecord.type]: ["name", "email", "picture_url"],
          ...(overview ? { [DatasetRecord.type]: ["name"] } : {}),
        },
        included: ["assigned_to", "entry_work_times", ...(overview ? ["dataset"] : [])],
        sort: this.entryProgressSort.length ? this.entryProgressSort : ["-created_at", "-id"],
        pagination: { ...this.entryProgressPagination },
        count: true,
        noCache: true,
      });
      if (!current()) return;
      this.entryProgressResponse = response;
    } catch (reason) {
      if (!current() || this.handleAccessError(reason)) return;
      this.entryProgressError = reason instanceof Error ? reason.message : "Entries are unavailable.";
    } finally {
      if (current()) this.entryProgressLoading = false;
    }
  }

  // ==================== Dataset Progress ====================

  public datasetProgressResponse: CollectionResponse<DatasetRecord> | null = $state.raw(null);
  public datasetProgressPagination: Pagination = $state.raw({ page: 1, itemsPerPage: 10 });
  public datasetProgressLoading = $state(false);
  public datasetProgressError = $state("");
  private datasetProgressGeneration = 0;

  public get datasetProgressRows(): DatasetRecord[] {
    if (this.disposed || this.denied || !this.scopeReady) return [];
    if (this.focused) return [this.focused];
    if (!this.selectedDatasetIds.length) return this.datasetProgressResponse?.data ?? [];

    const pagination = this.datasetProgressPagination;
    const start = (pagination.page - 1) * pagination.itemsPerPage;
    return this.selectedDatasets.slice(start, start + pagination.itemsPerPage);
  }

  public get datasetProgressTablePagination(): IDataTablePagination | undefined {
    if (!this.scopeReady || this.denied || this.disposed || this.focused) return undefined;
    const meta = this.selectedDatasetIds.length
      ? { count: this.selectedDatasets.length, more: false }
      : this.datasetProgressResponse?.meta;
    const count = meta?.count;
    if (typeof count !== "number" || !Number.isSafeInteger(count) || count < 0 || typeof meta?.more !== "boolean")
      return undefined;

    return { ...this.datasetProgressPagination, count, hasMore: meta.more };
  }

  public get datasetProgressCaption(): string {
    if (!this.scopeReady || this.denied || this.datasetProgressLoading || this.datasetProgressError) return "";
    if (this.focused) return "Showing 1 of 1 dataset";

    const shown = this.datasetProgressRows.length;
    if (shown === 0 && this.datasetProgressPagination.page > 1)
      return `Showing 0 datasets on page ${this.datasetProgressPagination.page}`;

    const pagination = this.datasetProgressTablePagination;
    if (pagination) {
      if (pagination.hasMore)
        return `Showing ${shown.toLocaleString()} ${shown === 1 ? "dataset" : "datasets"} · ${pagination.count.toLocaleString()}+ matching`;
      return `Showing ${shown.toLocaleString()} of ${pagination.count.toLocaleString()} ${pagination.count === 1 ? "dataset" : "datasets"}`;
    }
    return `Showing ${shown.toLocaleString()} ${shown === 1 ? "dataset" : "datasets"}`;
  }

  async changeDatasetProgressPage(pagination: Pagination): Promise<void> {
    if (this.disposed || this.denied || !this.scopeReady) return;
    if (
      !Number.isSafeInteger(pagination.page) ||
      pagination.page < 1 ||
      !Number.isSafeInteger(pagination.itemsPerPage) ||
      pagination.itemsPerPage < 1
    )
      return;
    const next = {
      page: pagination.itemsPerPage === this.datasetProgressPagination.itemsPerPage ? pagination.page : 1,
      itemsPerPage: pagination.itemsPerPage,
    };
    if (
      next.page === this.datasetProgressPagination.page &&
      next.itemsPerPage === this.datasetProgressPagination.itemsPerPage
    )
      return;

    this.datasetProgressPagination = next;
    if (this.focused || this.selectedDatasetIds.length) return;
    await this.loadDatasetProgress();
  }

  async retryDatasetProgress(): Promise<void> {
    if (this.disposed || this.denied || this.datasetProgressLoading) return;
    if (this.scopeReady) await this.loadDatasetProgress();
    else await this.retry();
  }

  private clearDatasetProgress(): void {
    this.datasetProgressGeneration++;
    this.datasetProgressResponse = null;
    this.datasetProgressLoading = false;
    this.datasetProgressError = "";
  }

  private async loadDatasetProgress(resetPage = false): Promise<void> {
    if (this.disposed || this.denied || !this.scopeReady) return;
    if (resetPage) this.datasetProgressPagination = { ...this.datasetProgressPagination, page: 1 };

    const scope = this.generation;
    const request = ++this.datasetProgressGeneration;
    const current = (): boolean => this.isCurrent(scope) && request === this.datasetProgressGeneration;
    this.datasetProgressResponse = null;
    this.datasetProgressError = "";
    this.datasetProgressLoading = false;
    if (this.focused || this.selectedDatasetIds.length) return;

    this.datasetProgressLoading = true;
    const pagination = { ...this.datasetProgressPagination };
    try {
      const response = await datasetsBackendDataSource.list({
        filters: { project_id: this.projectId },
        fields: {
          [DatasetRecord.type]: [
            "id",
            "name",
            "entries_total_count",
            "entries_completed_count",
            "progress",
            "delivery_date",
            "status",
          ],
        },
        sort: ["name", "id"],
        pagination,
        count: true,
        noCache: true,
      });
      if (!current()) return;
      if (!Array.isArray(response.data)) throw new Error("Dataset results are unavailable. Please retry.");
      this.datasetProgressResponse = response;
    } catch (reason) {
      if (!current() || this.handleAccessError(reason)) return;
      this.datasetProgressError = reason instanceof Error ? reason.message : "Dataset progress is unavailable.";
    } finally {
      if (current()) this.datasetProgressLoading = false;
    }
  }

  private handleAccessError(reason: unknown): boolean {
    const status = reason !== null && typeof reason === "object" && "status" in reason ? reason.status : undefined;
    if (status !== 401 && status !== 403 && status !== 404) return false;
    this.denyAccess(status);
    return true;
  }

  private denyAccess(status: number): void {
    this.generation++;
    this.clearMetrics();
    this.clearCompletionHistory();
    this.clearDatasetProgress();
    this.clearEntryProgress();
    this.denied = true;
    this.scopeReady = false;
    this.loading = false;
    this.error =
      status === 404 ? "This Project or Dataset is no longer available." : "Dashboard access is no longer available.";
    this.completionHistory = { ...this.completionHistory, status: "unavailable", error: this.error };
    this.datasetProgressError = this.error;
    this.entryProgressError = this.error;
  }

  // ==================== Request Lifecycle ====================

  private generation = 0;

  private isCurrent(generation: number): boolean {
    return !this.disposed && !this.denied && generation === this.generation;
  }

  private async loadSelectedDatasets(): Promise<void> {
    const generation = ++this.generation;
    const ids = [...this.selectedDatasetIds];
    this.loading = true;
    this.scopeReady = false;
    this.error = "";
    this.denied = false;

    try {
      const response = await datasetsBackendDataSource.list({
        filters: { project_id: this.projectId, id: ids },
        fields: {
          [DatasetRecord.type]: [
            "id",
            "name",
            "modality",
            "delivery_date",
            "entries_total_count",
            "entries_completed_count",
            "progress",
            "status",
          ],
        },
        sort: ["name", "id"],
        pagination: { page: 1, itemsPerPage: 100 },
        count: true,
        noCache: true,
      });
      if (!this.isCurrent(generation)) return;

      const count = response.meta?.count;
      if (typeof count !== "number" || !Number.isSafeInteger(count) || count < 0)
        throw new Error("Dataset count unavailable.");

      const returnedIds = response.data.map((record) => record.id);
      if (
        response.meta?.more ||
        response.data.length !== count ||
        response.data.length !== ids.length ||
        new SvelteSet(returnedIds).size !== returnedIds.length ||
        returnedIds.some((id) => !ids.includes(id))
      )
        throw new Error("Selected Dataset results could not be validated. Please try again.");
      this.selectedDatasets = response.data;
      this.scopeReady = true;
      this.loadMetrics();
    } catch (reason) {
      if (!this.isCurrent(generation)) return;
      if (!this.handleAccessError(reason)) {
        this.error = reason instanceof Error ? reason.message : "Unable to load datasets.";
        this.completionHistory = { ...this.completionHistory, status: "unavailable", error: this.error };
        this.datasetProgressError = this.error;
        this.entryProgressError = this.error;
      }
    } finally {
      if (this.isCurrent(generation)) this.loading = false;
    }
  }
}
