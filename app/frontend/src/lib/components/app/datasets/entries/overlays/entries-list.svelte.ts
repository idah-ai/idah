import { SvelteMap, SvelteURL } from "svelte/reactivity";

import { browser } from "$app/environment";
import { goto } from "$app/navigation";
import { page } from "$app/state";
import { get, writable, type Writable } from "svelte/store";

import { entriesBackendDataSource } from "@/data/model/dataset/entries/record";
import { ProjectMemberRecord } from "@/data/model/dataset/projects/members/record";
import { refetches } from "@/utils/refetch";

import { parseUrlFilters, writeFilterToUrl } from "@/components/app/datasets/entries/util/entry-filters";

import type { FilterDataSourceParams, SortDataSourceParams } from "@/components/app/datasource-table/types";
import type { ListOptions } from "@/data/DataSource";
import type { EntryRecord } from "@/data/model/dataset/entries/record";
import type { CollectionResponse } from "@/data/model/types";
import type { Hash } from "@/utils/types";

interface ViewPreferences {
  filters: Hash;
  sort: string[];
  itemsPerPage: number;
  currentPage: number;
}

const DEFAULT_PREFERENCES: ViewPreferences = {
  filters: {},
  sort: ["-created_at"],
  itemsPerPage: 10,
  currentPage: 1,
};

function loadPreferences(key: string): ViewPreferences {
  if (!browser) return DEFAULT_PREFERENCES;
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as ViewPreferences) : DEFAULT_PREFERENCES;
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export class EntriesListController {
  private readonly storageKey: string;
  private readonly datasetId: string;
  private readonly preferences: Writable<ViewPreferences>;
  private readonly unsubPreferences: () => void;
  private lastRefetchDate: Date | null = null;

  // ── Reactive state ──────────────────────────────────────────────────────────
  response: CollectionResponse<EntryRecord> = $state({ data: [], meta: {} });
  filters: Hash = $state({});
  sort: string[] = $state(["-created_at"]);
  currentPage: number = $state(1);
  itemsPerPage: number = $state(10);
  isFetching: boolean = $state(false);
  selectedEntryIds: string[] = $state([]);

  // ── Derived ─────────────────────────────────────────────────────────────────

  /** O(1) lookup map — avoids O(n×m) scans in selection filters */
  entryMap: Map<string, EntryRecord> = $derived(new SvelteMap(this.response.data.map((e) => [e.id, e])));

  listOptions: ListOptions = $derived({
    filters: this.filters,
    included: ["assigned_to", "submitted_by", "reviewed_by"],
    fields: { [ProjectMemberRecord.type]: ["name", "email", "picture_url"] },
    sort: this.sort,
    count: true,
    pagination: { page: this.currentPage, itemsPerPage: this.itemsPerPage },
  });

  isFiltering: boolean = $derived(
    Object.keys(this.filters).filter((k) => k !== "dataset_id").length > 0,
  );

  isRowSelected: boolean = $derived(this.selectedEntryIds.length > 0);

  selectedRowsCount: number = $derived(this.selectedEntryIds.length);

  /** Entries that can be assigned (not already in "done" step) */
  assignableEntryIds: string[] = $derived(
    this.selectedEntryIds.filter((id) => this.entryMap.get(id)?.wf_step !== "done"),
  );

  /** Entries that can be unassigned (not done and currently assigned) */
  unAssignableEntryIds: string[] = $derived(
    this.selectedEntryIds.filter((id) => {
      const e = this.entryMap.get(id);
      return e?.wf_step !== "done" && e?.assigned_to_id !== null;
    }),
  );

  constructor(datasetId: string) {
    this.datasetId = datasetId;
    this.storageKey = `idah:entries:${datasetId}:viewState`;

    const saved = loadPreferences(this.storageKey);
    this.filters = { dataset_id: datasetId, ...saved.filters };
    this.sort = saved.sort;
    this.currentPage = saved.currentPage;
    this.itemsPerPage = saved.itemsPerPage;

    this.preferences = writable<ViewPreferences>(saved);
    this.unsubPreferences = this.preferences.subscribe((val) => {
      if (browser) sessionStorage.setItem(this.storageKey, JSON.stringify(val));
    });
  }

  /**
   * Sync state from saved preferences or URL, then do the initial fetch.
   * Call this once from onMount.
   */
  async initFromUrl(): Promise<void> {
    const savedPrefs = get(this.preferences);

    if (savedPrefs.filters && Object.keys(savedPrefs.filters).length > 0) {
      // Restore URL to match saved filters
      const newUrl = new SvelteURL(page.url);
      for (const [key, value] of Object.entries(savedPrefs.filters)) {
        writeFilterToUrl(newUrl.searchParams, key, value);
      }
      /* eslint-disable svelte/no-navigation-without-resolve */
      goto(newUrl.href, { replaceState: true, keepFocus: true, noScroll: true });
      /* eslint-enable svelte/no-navigation-without-resolve */
    } else {
      const urlFilters = parseUrlFilters(page.url);
      this.filters = { dataset_id: this.datasetId, ...urlFilters };
      this._persist();
    }

    await this.fetch();
  }

  /**
   * Subscribe to the global refetch bus. Returns the unsubscribe function.
   * Call from onMount; pass the result to onDestroy.
   */
  subscribeToRefetches(): () => void {
    return refetches.subscribe(($val) => {
      if (this.lastRefetchDate !== null && $val.entries.list !== this.lastRefetchDate) {
        this.fetch();
      }
      this.lastRefetchDate = $val.entries.list;
    });
  }

  /** Release preferences store subscription. Call from onDestroy. */
  destroy(): void {
    this.unsubPreferences();
  }

  // ── Data ────────────────────────────────────────────────────────────────────

  async fetch(): Promise<void> {
    this.isFetching = true;
    try {
      this.response = await entriesBackendDataSource.list(this.listOptions);
    } finally {
      this.isFetching = false;
    }
  }

  async filterEntries(params: FilterDataSourceParams): Promise<void> {
    const newUrl = new SvelteURL(page.url);
    const updatedFilters = { ...this.filters };

    for (const [key, value] of Object.entries(params.filters)) {
      if (value === undefined) {
        delete updatedFilters[key];
        newUrl.searchParams.delete(`filters[${key}]`);
        newUrl.searchParams.delete(`filters[${key}][]`);
      } else {
        updatedFilters[key] = value;
        writeFilterToUrl(newUrl.searchParams, key, value);
      }
    }

    /* eslint-disable svelte/no-navigation-without-resolve */
    goto(newUrl.href, { replaceState: true, keepFocus: true, noScroll: true });
    /* eslint-enable svelte/no-navigation-without-resolve */

    this.currentPage = 1;
    this.filters = updatedFilters;
    this._persist();
    await this.fetch();
  }

  async sortEntries(params: SortDataSourceParams): Promise<void> {
    const { columnKey, sortDirection } = params;
    const sortPrefix = sortDirection === "desc" ? "-" : "";
    const sortKey = `${sortPrefix}${columnKey}`;

    if (sortDirection === "none") {
      this.sort = this.sort.filter((s) => !s.endsWith(columnKey));
    } else if (this.sort.some((s) => s.endsWith(columnKey))) {
      this.sort = this.sort.map((s) => (s.endsWith(columnKey) ? sortKey : s));
    } else {
      this.sort = [...this.sort, sortKey];
    }

    this.currentPage = 1;
    this._persist();
    await this.fetch();
  }

  async changePage(newPage: number): Promise<void> {
    this.currentPage = newPage;
    this._persist();
    await this.fetch();
  }

  async setItemsPerPage(n: number): Promise<void> {
    this.currentPage = 1;
    this.itemsPerPage = n;
    this._persist();
    await this.fetch();
  }

  // ── Selection ───────────────────────────────────────────────────────────────

  selectRow(id: string): void {
    if (this.selectedEntryIds.includes(id)) {
      this.selectedEntryIds = this.selectedEntryIds.filter((i) => i !== id);
    } else {
      this.selectedEntryIds = [...this.selectedEntryIds, id];
    }
  }

  toggleSelectAll(checked: boolean): void {
    this.selectedEntryIds = checked ? this.response.data.map((e) => e.id) : [];
  }

  clearSelection(): void {
    this.selectedEntryIds = [];
  }

  // ── Mutations helpers ───────────────────────────────────────────────────────

  /** Patch updated entries into the local response without a network round-trip. */
  patchEntries(updated: EntryRecord[]): void {
    const updateMap = new SvelteMap(updated.map((e) => [e.id, e]));
    this.response.data = this.response.data.map((e) => updateMap.get(e.id) ?? e);
  }

  checkAnyAssigned(ids: string[]): boolean {
    return ids.some((id) => !!this.entryMap.get(id)?.assigned_to_id);
  }

  getEntryName(id: string): string | undefined {
    return this.entryMap.get(id)?.name;
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  private _persist(): void {
    const { dataset_id: _, ...userFilters } = this.filters as Hash & { dataset_id?: unknown };
    this.preferences.set({
      filters: userFilters,
      sort: this.sort,
      itemsPerPage: this.itemsPerPage,
      currentPage: this.currentPage,
    });
  }
}
