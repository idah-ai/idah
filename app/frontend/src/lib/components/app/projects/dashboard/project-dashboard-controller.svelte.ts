import { DatasetRecord, datasetsBackendDataSource } from "@/data/model/dataset/dataset-record";
import { getContext, setContext } from "svelte";
import type { SvelteMap } from "svelte/reactivity";

export const PROJECT_DASHBOARD_CONTROLLER_KEY = Symbol("project-dashboard-controller");

export function setProjectDashboardController(key: symbol, controller: ProjectDashboardController) {
  setContext(key, controller);
}

export function getProjectDashboardController(key: symbol): ProjectDashboardController {
  return getContext(key);
}

export class ProjectDashboardController {
  public id: string;

  public selectedDatasetIds: Array<string> = [];
  // public datasetMap: SvelteMap<string, DatasetRecord> = new SvelteMap();

  // Section:: Total Entries
  // public totalEntries: number = $derived(this.selectedDatasetIds.length);

  // Section:: Entries By Status
  public entriesStatusCardIsLoading: boolean = $state(false);

  // Section:: Completed Entries Per Period
  public completedEntriesPerPeriodCardIsLoading: boolean = $state(false);

  constructor(projectId: string) {
    this.id = projectId;
  }

  async loadData() {
    const res = datasetsBackendDataSource.list({
      filters: {
        id__in: this.selectedDatasetIds,
      },
    });
  }

  async previousDataset() {
    this.entriesStatusCardIsLoading = true;
    this.completedEntriesPerPeriodCardIsLoading = true;

    await this.loadData();

    // return this.datasetMap.get();
    this.entriesStatusCardIsLoading = false;
  }

  async nextDataset() {}

  async selectDataset(datasetId: string) {
    if (this.selectedDatasetIds.includes(datasetId)) {
      this.selectedDatasetIds.filter((id) => id !== datasetId);
    } else {
      this.selectedDatasetIds.push(datasetId);
    }

    this.loadData();
  }

  async clearSelection() {}
}
