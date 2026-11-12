import { getContext, setContext } from "svelte";
import { SvelteSet } from "svelte/reactivity";
import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  endOfDay,
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
import { datasetsStatuses } from "@/data/model/dataset/datasets/constants";
import { getDeliveryStatusBadge, today } from "@/utils/date";
import { PROJECT_DASHBOARD_WORKFLOW_GROUPS } from "@/components/app/projects/dashboard/project-dashboard.constants";
import type { Filters } from "@/data/filtering";
import type { JsonApiMeta } from "@/data/model/types";
import type {
  CompletionGrouping,
  CompletionRange,
  CompletionHistoryResult,
  CompletionBucket,
} from "@/components/app/projects/dashboard/project-dashboard.types";

export const PROJECT_DASHBOARD_CONTROLLER_KEY = Symbol("project-dashboard-controller");

export function setProjectDashboardController(key: symbol, controller: ProjectDashboardController): void {
  setContext<ProjectDashboardController>(key, controller);
}

export function getProjectDashboardController(key: symbol): ProjectDashboardController {
  const controller = getContext<ProjectDashboardController | undefined>(key);

  if (!controller) throw new Error("Project Dashboard controller is not available.");
  return controller;
}

type DeliveryBreakdown = {
  overdue: number;
  dueToday: number;
  dueTomorrow: number;
  upcoming: { date: string; count: number } | null;
};

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
        if (this.completionHistory.zone !== Intl.DateTimeFormat().resolvedOptions().timeZone)
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
    this.loadMetrics();
  }

  step(delta: -1 | 1): void {
    if (this.disposed || this.denied || this.loading || !this.scopeReady || !this.selectedDatasets.length) return;
    const records = this.selectedDatasets;
    if (!this.focused) {
      this.generation++;
      this.focused = delta === 1 ? records[0] : records[records.length - 1];
      this.loadMetrics();
      return;
    }
    const index = records.findIndex((record) => record.id === this.focused?.id);
    const next = records[(index + delta + records.length) % records.length];
    if (next.id === this.focused.id) return;
    this.generation++;
    this.focused = next;
    this.loadMetrics();
  }

  async retry(): Promise<void> {
    if (this.disposed || this.loading || !this.error || !this.selectedDatasetIds.length) return;
    await this.loadSelectedDatasets();
  }

  // ==================== Summary & Metrics ====================

  public summary: { total: number; completed: number; review: number; annotation: number } | null = $state.raw(null);
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
    return this.scopeReady && !this.denied ? (this.summary?.total ?? this.datasetTotal) : null;
  }

  public get progress(): number | null {
    return this.summary
      ? this.summary.total
        ? Math.round((this.summary.completed / this.summary.total) * 100)
        : 0
      : null;
  }

  public get openEntriesCount(): number | null {
    return this.summary ? this.summary.total - this.summary.completed : null;
  }

  public get openEntriesDescription(): string {
    if (this.summaryLoading) return "";
    const summary = this.summary;
    if (!summary) return "Workflow breakdown unavailable";
    const parts = [
      `${summary.review.toLocaleString()} in review`,
      `${summary.annotation.toLocaleString()} in annotation`,
    ];
    const outsideWorkflow = summary.total - summary.completed - summary.review - summary.annotation;
    if (outsideWorkflow) parts.push(`${outsideWorkflow.toLocaleString()} outside active workflow`);
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
    this.workflowCounts = null;
    this.workflowLoading = false;
    this.workflowError = "";
  }

  private loadMetrics(): void {
    if (this.disposed || this.denied || !this.scopeReady) return;
    this.clearMetrics();
    void this.loadSummary();
    void this.loadAttention();
    void this.loadWorkflowCounts();
    void this.loadCompletionHistory();
  }

  async retrySummary(): Promise<void> {
    if (this.disposed || this.denied || !this.scopeReady || this.summaryLoading) return;
    await this.loadSummary();
  }

  private async loadSummary(): Promise<void> {
    const scope = this.generation;
    const ids = this.effectiveDatasetIds;
    const datasetTotal = this.datasetTotal;
    const current = (): boolean => this.isCurrent(scope);

    this.summary = null;
    this.summaryLoading = true;
    this.summaryError = "";
    try {
      const results = await Promise.allSettled([
        datasetTotal === null ? this.countEntries(ids, {}, current) : Promise.resolve(datasetTotal),
        this.countEntries(ids, { status__in: ["completed"] }, current),
        this.countEntries(ids, { status__in: ["pending", "in_progress"], wf_step__in: ["review"] }, current),
        this.countEntries(ids, { status__in: ["pending", "in_progress"], wf_step__in: ["annotate"] }, current),
      ]);
      if (!current()) return;

      const [initialTotal, completed, review, annotation] = results.map((result) => {
        if (result.status === "rejected") throw result.reason;
        return result.value;
      });
      let total = initialTotal;
      const minimumTotal = completed + review + annotation;

      if (datasetTotal !== null && minimumTotal > total) {
        total = await this.countEntries(ids, {}, current);
      }
      if (!current()) return;
      if (minimumTotal > total) {
        throw new Error("Dashboard counts changed while loading. Please try again.");
      }
      this.summary = { total, completed, review, annotation };
    } catch (reason) {
      if (current()) this.summaryError = reason instanceof Error ? reason.message : "Dashboard counts unavailable.";
    } finally {
      if (current()) this.summaryLoading = false;
    }
  }

  private async countEntries(ids: string[], filters: Filters, current: () => boolean): Promise<number> {
    if (!current()) throw new Error("Dashboard request retired");
    try {
      const response = await entriesBackendDataSource.list({
        filters: { ...filters, project_id: this.projectId, ...(ids.length ? { dataset_id: ids } : {}) },
        fields: { [EntryRecord.type]: ["id"] },
        sort: ["id"],
        pagination: { page: 1, itemsPerPage: 1 },
        count: true,
        noCache: true,
      });

      if (!current()) throw new Error("Dashboard request retired");
      return this.exactCount(response.meta);
    } catch (reason) {
      if (current()) this.handleAccessError(reason);
      throw reason;
    }
  }

  private exactCount(meta: JsonApiMeta | undefined): number {
    const count = meta?.count;
    if (typeof count !== "number" || !Number.isSafeInteger(count) || count < 0) throw new Error("Count unavailable.");
    if (meta?.more !== false) throw new Error("An exact count is unavailable for this scope.");
    return count;
  }

  // ==================== Entries by Status ====================

  public workflowCounts: { reviewing: number; annotating: number } | null = $state.raw(null);
  public workflowLoading = $state(false);
  public workflowError = $state("");
  private workflowGeneration = 0;

  public get workflowDistribution(): {
    total: number;
    residual: number;
    groups: { label: string; value: number; bgColor: string }[];
  } | null {
    const summary = this.summary;
    const counts = this.workflowCounts;
    if (!summary || !counts) return null;

    const values = {
      completed: summary.completed,
      reviewing: counts.reviewing,
      pendingReview: summary.review - counts.reviewing,
      annotating: counts.annotating,
      pendingAnnotation: summary.annotation - counts.annotating,
    };
    const residual = summary.total - summary.completed - summary.review - summary.annotation;
    if (values.pendingReview < 0 || values.pendingAnnotation < 0 || residual < 0) return null;
    return {
      total: summary.total,
      residual,
      groups: PROJECT_DASHBOARD_WORKFLOW_GROUPS.map((group) => ({ ...group, value: values[group.key] })),
    };
  }

  async retryWorkflowCounts(): Promise<void> {
    if (this.disposed || this.denied || !this.scopeReady || this.workflowLoading) return;
    if (this.summary && this.workflowCounts && !this.workflowDistribution) {
      await Promise.all([this.retrySummary(), this.loadWorkflowCounts()]);
      return;
    }
    await this.loadWorkflowCounts();
  }

  private async loadWorkflowCounts(): Promise<void> {
    const scope = this.generation;
    const request = ++this.workflowGeneration;
    const ids = this.effectiveDatasetIds;
    const current = (): boolean => this.isCurrent(scope) && request === this.workflowGeneration;
    this.workflowCounts = null;
    this.workflowLoading = true;
    this.workflowError = "";
    try {
      const [reviewing, annotating] = await Promise.all([
        this.countEntries(
          ids,
          { status__in: ["pending", "in_progress"], wf_step__in: ["review"], assigned: true },
          current,
        ),
        this.countEntries(
          ids,
          { status__in: ["pending", "in_progress"], wf_step__in: ["annotate"], assigned: true },
          current,
        ),
      ]);
      if (current()) this.workflowCounts = { reviewing, annotating };
    } catch (reason) {
      if (current()) this.workflowError = reason instanceof Error ? reason.message : "Workflow counts unavailable.";
    } finally {
      if (current()) this.workflowLoading = false;
    }
  }

  // ==================== Attention & Local Reporting Day ====================

  public attentionBreakdown: DeliveryBreakdown | null = $state.raw(null);

  public get attention(): number | null {
    const breakdown = this.attentionBreakdown;
    return breakdown
      ? breakdown.overdue + breakdown.dueToday + breakdown.dueTomorrow + (breakdown.upcoming?.count ?? 0)
      : null;
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
    if (breakdown.overdue) parts.push(`${breakdown.overdue.toLocaleString()} overdue`);
    if (breakdown.dueToday) parts.push(`${breakdown.dueToday.toLocaleString()} due today`);
    if (breakdown.dueTomorrow) parts.push(`${breakdown.dueTomorrow.toLocaleString()} due tomorrow`);
    if (breakdown.upcoming) {
      const days = differenceInCalendarDays(parseISO(breakdown.upcoming.date), this.reportingDay);
      parts.push(`${breakdown.upcoming.count.toLocaleString()} due in ${days} days`);
    }
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
      if (this.selectedDatasetIds.length) {
        if (this.selectedDatasets.length !== this.selectedDatasetIds.length)
          throw new Error("Selected Dataset metadata is incomplete. Please reload the selection.");
        const breakdown: DeliveryBreakdown = { overdue: 0, dueToday: 0, dueTomorrow: 0, upcoming: null };

        for (const record of this.selectedDatasets) {
          if (record.status === "completed" || !record.delivery_date) continue;

          const date = parseISO(record.delivery_date);
          if (!isValid(date)) throw new Error("Dataset delivery date is invalid.");

          const days = differenceInCalendarDays(date, day);
          if (days < 0) breakdown.overdue++;
          else if (days === 0) breakdown.dueToday++;
          else if (days === 1) breakdown.dueTomorrow++;
          else if (!breakdown.upcoming || record.delivery_date < breakdown.upcoming.date)
            breakdown.upcoming = { date: record.delivery_date, count: 1 };
          else if (record.delivery_date === breakdown.upcoming.date) breakdown.upcoming.count++;
        }
        this.attentionBreakdown = breakdown;
        return;
      }
      const todayDate = format(day, "yyyy-MM-dd");
      const tomorrowDate = format(addDays(day, 1), "yyyy-MM-dd");
      const [overdue, dueToday, dueTomorrow, upcoming] = await Promise.all([
        this.countDatasets({ delivery_date__lte: format(addDays(day, -1), "yyyy-MM-dd") }, current),
        this.countDatasets({ delivery_date__gte: todayDate, delivery_date__lte: todayDate }, current),
        this.countDatasets({ delivery_date__gte: tomorrowDate, delivery_date__lte: tomorrowDate }, current),
        this.upcomingDelivery(day, current),
      ]);

      if (!current()) return;
      this.attentionBreakdown = { overdue, dueToday, dueTomorrow, upcoming };
    } catch (reason) {
      if (current())
        this.attentionError =
          reason instanceof Error ? reason.message : "Delivery breakdown unavailable for this scope.";
    } finally {
      if (current()) this.attentionLoading = false;
    }
  }

  private attentionFilters(filters: Filters): Filters {
    return {
      ...filters,
      project_id: this.projectId,
      status__in: datasetsStatuses.filter((status) => status.value !== "completed").map((status) => status.value),
    };
  }

  private async countDatasets(filters: Filters, current: () => boolean): Promise<number> {
    if (!current()) throw new Error("Dashboard request retired");
    try {
      const response = await datasetsBackendDataSource.list({
        filters: this.attentionFilters(filters),
        fields: { [DatasetRecord.type]: ["id"] },
        sort: ["id"],
        pagination: { page: 1, itemsPerPage: 1 },
        count: true,
        noCache: true,
      });
      if (!current()) throw new Error("Dashboard request retired");
      return this.exactCount(response.meta);
    } catch (reason) {
      if (current()) this.handleAccessError(reason);
      throw reason;
    }
  }

  private async upcomingDelivery(day: Date, current: () => boolean): Promise<DeliveryBreakdown["upcoming"]> {
    if (!current()) throw new Error("Dashboard request retired");
    const from = format(addDays(day, 2), "yyyy-MM-dd");
    try {
      const nearest = await datasetsBackendDataSource.list({
        filters: this.attentionFilters({ delivery_date__gte: from }),
        fields: { [DatasetRecord.type]: ["id", "delivery_date"] },
        sort: ["delivery_date"],
        pagination: { page: 1, itemsPerPage: 1 },
        count: false,
        noCache: true,
      });

      if (!current()) throw new Error("Dashboard request retired");
      if (!nearest.data.length) return null;
      const date = nearest.data[0].delivery_date;
      if (!date || !isValid(parseISO(date))) throw new Error("Upcoming delivery date is invalid. Please retry.");
      const response = await datasetsBackendDataSource.list({
        // Recheck the earliest date while counting: if a new earlier date appeared,
        // reject the result instead of presenting this range count as a single-date count.
        filters: this.attentionFilters({ delivery_date__gte: from, delivery_date__lte: date }),
        fields: { [DatasetRecord.type]: ["id", "delivery_date"] },
        sort: ["delivery_date"],
        pagination: { page: 1, itemsPerPage: 1 },
        count: true,
        noCache: true,
      });

      if (!current()) throw new Error("Dashboard request retired");
      const count = this.exactCount(response.meta);
      if (!count || response.data[0]?.delivery_date !== date)
        throw new Error("Upcoming delivery date changed. Please retry.");
      return { date, count };
    } catch (reason) {
      if (current()) this.handleAccessError(reason);
      throw reason;
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
      !isAfter(parseISO(range.start), parseISO(range.end)) &&
      !isAfter(parseISO(range.end), this.reportingDay)
    );
  }

  public completionGroupingAllowed(grouping: CompletionGrouping): boolean {
    const days = differenceInCalendarDays(parseISO(this.completionRange.end), parseISO(this.completionRange.start)) + 1;
    return grouping === "Day" ? days <= 62 : grouping === "Month" ? days >= 60 : days >= 14;
  }

  public setCompletionGrouping(grouping: CompletionGrouping): void {
    if (this.completionGroupingAllowed(grouping)) this.completionGrouping = grouping;
  }

  public async applyCompletionRange(range: CompletionRange): Promise<void> {
    if (this.disposed || this.denied || !this.isCompletionRangeValid(range)) return;
    this.completionRange = { ...range };
    const days = differenceInCalendarDays(parseISO(range.end), parseISO(range.start)) + 1;
    this.completionGrouping = days <= 14 ? "Day" : days <= 92 ? "Week" : "Month";
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
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    const current = (): boolean =>
      this.isCurrent(scope) &&
      request === this.completionGeneration &&
      zone === Intl.DateTimeFormat().resolvedOptions().timeZone;

    this.completionHistory = { status: "loading", daily: {}, zone, error: "" };

    const daily: Record<string, number> = {};

    try {
      const start = startOfDay(parseISO(range.start));
      const end = addDays(startOfDay(parseISO(range.end)), 1);

      // PostgreSQL keeps six fractional digits. Do not pass this string through Date again.
      const endInclusive = endOfDay(parseISO(range.end))
        .toISOString()
        .replace(/\.999Z$/, ".999999Z");

      let cursor = "";

      while (current()) {
        const response = await entriesBackendDataSource.list({
          filters: {
            project_id: this.projectId,
            ...(ids.length ? { dataset_id: ids } : {}),
            status__in: ["completed"],
            completed_at__gte: start.toISOString(),
            completed_at__lte: endInclusive,
            ...(cursor ? { id__gt: cursor } : {}),
          },
          fields: { [EntryRecord.type]: ["id", "completed_at"] },
          sort: ["id"],
          pagination: { page: 1, itemsPerPage: 1000 },
          count: false,
          noCache: true,
        });

        if (!current()) return;

        if (!Array.isArray(response.data) || response.data.length > 1000) {
          throw new Error("Completion results could not be validated. Retry.");
        }

        const batch: Record<string, number> = {};
        let next = cursor;

        for (const record of response.data) {
          const timestamp = record.completed_at;

          if (
            typeof record.id !== "string" ||
            !record.id ||
            record.id <= next ||
            !(timestamp instanceof Date) ||
            !isValid(timestamp) ||
            isBefore(timestamp, start) ||
            !isBefore(timestamp, end)
          ) {
            throw new Error("Completion results changed or did not advance. Retry.");
          }

          next = record.id;

          const day = format(timestamp, "yyyy-MM-dd");
          batch[day] = (batch[day] ?? 0) + 1;
        }

        for (const [day, count] of Object.entries(batch)) {
          daily[day] = (daily[day] ?? 0) + count;
        }

        cursor = next;

        const finished = response.data.length < 1000;

        this.completionHistory = {
          status: finished ? (cursor ? "ready" : "empty") : "loading",
          daily: { ...daily },
          zone,
          error: "",
        };

        if (finished) return;
      }
    } catch (reason) {
      if (!current() || this.handleAccessError(reason)) return;

      this.completionHistory = {
        status: Object.keys(daily).length ? "partial" : "unavailable",
        daily: { ...daily },
        zone,
        error: reason instanceof Error ? reason.message : "Recorded completions are unavailable.",
      };
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
    this.denied = true;
    this.scopeReady = false;
    this.loading = false;
    this.error =
      status === 404 ? "This Project or Dataset is no longer available." : "Dashboard access is no longer available.";
    this.completionHistory = { ...this.completionHistory, status: "unavailable", error: this.error };
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
      }
    } finally {
      if (this.isCurrent(generation)) this.loading = false;
    }
  }
}
