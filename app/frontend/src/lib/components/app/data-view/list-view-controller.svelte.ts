import { SvelteMap, SvelteURL } from "svelte/reactivity";

import { browser } from "$app/environment";
import { goto } from "$app/navigation";
import { page } from "$app/state";
import { get, writable, type Writable } from "svelte/store";

import { parseUrlFilters, writeFilterToUrl } from "@/components/app/data-view/url-filters";
import { refetches, type RefetchesKey } from "@/utils/refetch";

import type {
  FilterDataSourceParams,
  ListViewControllerConfig,
  SortDataSourceParams,
} from "@/components/app/data-view/types";
import type { BackendDataSource } from "@/data/BackendDataSource";
import type { ListOptions } from "@/data/DataSource";
import type { Record } from "@/data/model/Record";
import type { CollectionResponse } from "@/data/model/types";
import type { Hash } from "@/utils/types";

interface ViewPreferences {
  filters: Hash;
  sort: string[];
  itemsPerPage: number;
  currentPage: number;
}

function loadPreferences(key: string, defaultSort: string[]): ViewPreferences {
  const fallback: ViewPreferences = { filters: {}, sort: defaultSort, itemsPerPage: 10, currentPage: 1 };
  if (!browser) return fallback;
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as ViewPreferences) : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Generic, reusable list-view state controller.
 *
 * Owns filtering, sorting, pagination, row selection, URL sync, session-storage
 * persistence and the refetch-bus subscription for any `Record` collection. Domain-specific
 * derivations (e.g. which rows are assignable) live outside this class, computed from its state.
 */
export class ListViewController<T extends Record> {
  private readonly dataSource: BackendDataSource<T>;
  private readonly storageKey: string;
  private readonly refetchKey: RefetchesKey;
  /** Base options merged into every request (pinned filters, `included`, `fields`, default sort). */
  private readonly baseListOptions: ListOptions;
  private readonly defaultSort: string[];
  private readonly preferences: Writable<ViewPreferences>;
  private readonly unsubPreferences: () => void;
  private lastRefetchDate: Date | null = null;

  // ── Reactive state ──────────────────────────────────────────────────────────
  response: CollectionResponse<T> = $state({ data: [], meta: {} });
  /** User-applied filters only. Pinned/base filters live in `baseListOptions`. */
  filters: Hash = $state({});
  sort: string[] = $state([]);
  currentPage: number = $state(1);
  itemsPerPage: number = $state(10);
  isFetching: boolean = $state(false);
  selectedIds: string[] = $state([]);

  // ── Derived ─────────────────────────────────────────────────────────────────
  // Getter (not `$derived`) because it reads `baseListOptions`, which is assigned in the
  // constructor — a `$derived` field initializer would run before that assignment. Reading
  // the `$state` fields inside keeps it reactive when accessed in templates/effects.
  get listOptions(): ListOptions {
    return {
      ...this.baseListOptions,
      filters: { ...this.baseListOptions.filters, ...this.filters },
      sort: this.sort,
      count: true,
      pagination: { page: this.currentPage, itemsPerPage: this.itemsPerPage },
    };
  }

  isFiltering: boolean = $derived(Object.keys(this.filters).length > 0);
  isRowSelected: boolean = $derived(this.selectedIds.length > 0);
  selectedRowsCount: number = $derived(this.selectedIds.length);

  constructor(config: ListViewControllerConfig<T>) {
    this.dataSource = config.dataSource;
    this.storageKey = config.storageKey;
    this.refetchKey = config.refetchKey;
    this.baseListOptions = config.listOptions ?? {};
    this.defaultSort = this.baseListOptions.sort ?? [];

    const saved = loadPreferences(this.storageKey, this.defaultSort);
    this.filters = saved.filters;
    this.sort = saved.sort;
    this.currentPage = saved.currentPage;
    this.itemsPerPage = saved.itemsPerPage;

    this.preferences = writable<ViewPreferences>(saved);
    this.unsubPreferences = this.preferences.subscribe((val) => {
      if (browser) sessionStorage.setItem(this.storageKey, JSON.stringify(val));
    });
  }

  /**
   * Sync state from the URL (explicit filters win) or saved preferences, then do the
   * initial fetch. Call this once when the view mounts.
   */
  async initFromUrl(): Promise<void> {
    const urlFilters = parseUrlFilters(page.url);

    if (Object.keys(urlFilters).length > 0) {
      // URL carries explicit filters — they win over any stale session state, but apply to
      // this view only. Do not persist: writing them to sessionStorage would make them
      // resurrect in the URL (via the `goto` below) on every future visit, with no UI control
      // to clear filter keys that have no matching column.
      this.filters = urlFilters;
    } else {
      // No URL filters — restore saved session prefs and sync them into the URL
      const savedPrefs = get(this.preferences);
      if (savedPrefs.filters && Object.keys(savedPrefs.filters).length > 0) {
        const newUrl = new SvelteURL(page.url);
        for (const [key, value] of Object.entries(savedPrefs.filters)) {
          writeFilterToUrl(newUrl.searchParams, key, value);
        }
        /* eslint-disable svelte/no-navigation-without-resolve */
        goto(newUrl.href, { replaceState: true, keepFocus: true, noScroll: true });
        /* eslint-enable svelte/no-navigation-without-resolve */
      }
    }

    await this.fetch();
  }

  /**
   * Subscribe to the global refetch bus. Returns the unsubscribe function.
   * Call from onMount; pass the result to onDestroy.
   */
  subscribeToRefetches(): () => void {
    return refetches.subscribe(($val) => {
      const stamp = $val[this.refetchKey].list;
      if (this.lastRefetchDate !== null && stamp !== this.lastRefetchDate) {
        this.fetch();
      }
      this.lastRefetchDate = stamp;
    });
  }

  /** Release the preferences store subscription. Call from onDestroy. */
  destroy(): void {
    this.unsubPreferences();
  }

  // ── Data ────────────────────────────────────────────────────────────────────

  async fetch(): Promise<void> {
    this.isFetching = true;
    try {
      this.response = await this.dataSource.list(this.listOptions);
    } finally {
      this.isFetching = false;
    }
  }

  async applyFilter(params: FilterDataSourceParams): Promise<void> {
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

  async applySort(params: SortDataSourceParams): Promise<void> {
    const { columnKey, sortDirection } = params;
    const sortPrefix = sortDirection === "desc" ? "-" : "";
    const sortKey = `${sortPrefix}${columnKey}`;

    const matchesColumn = (s: string) => s.replace(/^-/, "") === columnKey;

    if (sortDirection === "none") {
      this.sort = this.sort.filter((s) => !matchesColumn(s));
    } else if (this.sort.some(matchesColumn)) {
      this.sort = this.sort.map((s) => (matchesColumn(s) ? sortKey : s));
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

  toggleSelect(id: string): void {
    if (this.selectedIds.includes(id)) {
      this.selectedIds = this.selectedIds.filter((i) => i !== id);
    } else {
      this.selectedIds = [...this.selectedIds, id];
    }
  }

  toggleSelectAll(checked: boolean): void {
    this.selectedIds = checked ? this.response.data.map((e) => e.id) : [];
  }

  clearSelection(): void {
    this.selectedIds = [];
  }

  // ── Mutation helpers ─────────────────────────────────────────────────────────

  /** Patch updated records into the local response without a network round-trip. */
  patchRecords(updated: T[]): void {
    const updateMap = new SvelteMap(updated.map((e) => [e.id, e]));
    this.response.data = this.response.data.map((e) => updateMap.get(e.id) ?? e);
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  private _persist(): void {
    this.preferences.set({
      filters: this.filters,
      sort: this.sort,
      itemsPerPage: this.itemsPerPage,
      currentPage: this.currentPage,
    });
  }
}
