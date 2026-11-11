import { getContext, setContext } from "svelte";
import { SvelteSet } from "svelte/reactivity";

import { DatasetRecord, datasetsBackendDataSource } from "@/data/model/dataset/dataset-record";

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

  constructor(public readonly projectId: string) {}

  async start(): Promise<void> {
    if (this.started || this.disposed) return;
    this.started = true;
    await this.select([]);
  }

  dispose(): void {
    this.disposed = true;
    this.generation++;
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
    this.selectedDatasetIds = selected;
    this.focused = null;
    this.selectedDatasets = [];

    if (selected.length === 0) {
      this.generation++;
      this.scopeReady = true;
      this.loading = false;
      this.error = "";
      this.denied = false;
      return;
    }
    await this.loadSelectedDatasets();
  }

  // ==================== Dataset Navigation ====================

  public get showDatasetNavigation(): boolean {
    return this.selectedDatasetIds.length >= 1;
  }

  showAllDatasets(): void {
    if (this.disposed || this.denied || this.loading) return;
    this.focused = null;
  }

  step(delta: -1 | 1): void {
    if (this.disposed || this.denied || this.loading || !this.scopeReady || !this.selectedDatasets.length) return;
    const records = this.selectedDatasets;
    if (!this.focused) {
      this.focused = delta === 1 ? records[0] : records[records.length - 1];
      return;
    }
    const index = records.findIndex((record) => record.id === this.focused?.id);
    this.focused = records[(index + delta + records.length) % records.length];
  }

  async retry(): Promise<void> {
    if (this.disposed || this.loading || !this.error || !this.selectedDatasetIds.length) return;
    await this.loadSelectedDatasets();
  }

  // ==================== Request Lifecycle ====================

  private generation = 0;

  private isCurrent(generation: number): boolean {
    return !this.disposed && generation === this.generation;
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
        new SvelteSet(returnedIds).size !== returnedIds.length ||
        returnedIds.some((id) => !ids.includes(id))
      )
        throw new Error("Selected Dataset results could not be validated. Please try again.");
      this.selectedDatasets = response.data;
      this.scopeReady = true;
    } catch (reason) {
      if (!this.isCurrent(generation)) return;
      const status = reason !== null && typeof reason === "object" && "status" in reason ? reason.status : undefined;
      if (status === 401 || status === 403 || status === 404) {
        this.denied = true;
        this.error =
          status === 404
            ? "This Project or Dataset is no longer available."
            : "Dashboard access is no longer available.";
      } else {
        this.error = reason instanceof Error ? reason.message : "Unable to load datasets.";
      }
    } finally {
      if (this.isCurrent(generation)) this.loading = false;
    }
  }
}
