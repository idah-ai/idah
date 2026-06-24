import type { Snippet } from "svelte";

import type { ListViewController } from "@/components/app/data-view/list-view-controller.svelte";
import type { BackendDataSource } from "@/data/BackendDataSource";
import type { ListOptions } from "@/data/DataSource";
import type { Record } from "@/data/model/Record";
import type { RefetchesKey } from "@/utils/refetch";

// Reuse the existing filter/sort param shapes from datasource-table so DataView and
// DataSourceTable speak the same language (read-only dependency — datasource-table is untouched).
export type { FilterDataSourceParams, SortDataSourceParams } from "@/components/app/datasource-table/types";

export interface ListViewControllerConfig<T extends Record> {
  /** Backend data source used for `list()`. */
  dataSource: BackendDataSource<T>;
  /** sessionStorage key for persisted view preferences (filters/sort/page/itemsPerPage). */
  storageKey: string;
  /**
   * Base list options applied on every fetch (e.g. pinned filters, `included`, `fields`,
   * and the default `sort`). Reactive user filters/sort/pagination are merged on top.
   */
  listOptions?: ListOptions;
  /** Refetch bus key — the controller refetches when `refetches[refetchKey].list` changes. */
  refetchKey: RefetchesKey;
}

export interface DataViewProps<T extends Record> {
  controller: ListViewController<T>;
  /** Optional toolbar rendered above the list. */
  ToolbarSlot?: Snippet;
  /** Per-record renderer (the card). */
  DataSlot: Snippet<[{ record: T }]>;
  /** Rendered when there are no records. Receives whether a user filter is active. */
  EmptyState?: Snippet<[{ isFiltering: boolean }]>;
  /** Rendered while the first/active fetch is in flight and there are no records yet. */
  LoadingState?: Snippet;
  /** Hide the paginator entirely. */
  hidePagination?: boolean;
}
