<script lang="ts">
  import { browser } from "$app/environment";
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { page } from "$app/state";
  import { getContext, onDestroy, onMount } from "svelte";
  import { writable, type Writable } from "svelte/store";

  import ResponseBlock from "@/components/app/blocks/response-block.svelte";
  import EntryCard from "@/components/app/datasets/entries/cards/entry-card.svelte";
  import AssignEntryFormModal from "@/components/app/datasets/entries/overlays/assign-entry-form-modal.svelte";
  import UpdateEntryPriorityFormModal from "@/components/app/datasets/entries/overlays/update-entry-priority-form-modal.svelte";
  import UploadEntryFormModal from "@/components/app/datasets/entries/overlays/UploadEntryFormModal.svelte";
  import FilterSortDropdownMenu from "@/components/app/dropdown-menus/filter-sort-dropdown-menu.svelte";
  import ConfirmModal from "@/components/app/overlays/modals/confirm-modal.svelte";
  import PageHeader from "@/components/app/page/page-header.svelte";
  import AppPaginator from "@/components/app/paginators/app-paginator.svelte";
  import Button from "@/components/ui/button/button.svelte";
  import { Card, CardContent } from "@/components/ui/card";
  import Checkbox from "@/components/ui/checkbox/checkbox.svelte";
  import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuTrigger,
  } from "@/components/ui/dropdown-menu";
  import Spinner from "@/components/ui/spinner/spinner.svelte";
  import Can from "@/security/can.svelte";

  import {
    ArrowDownAZIcon,
    ArrowDownZAIcon,
    ArrowUpDownIcon,
    ChevronsUpDownIcon,
    FunnelIcon,
    LayoutListIcon,
    PlusIcon,
  } from "@lucide/svelte";

  import { entryColumns } from "@/components/app/datasets/entries/data-tables/entry-columns";
  import { getEntryDropdownMenuActions } from "@/components/app/datasets/entries/dropdown-menus/entry-dropdown-menu";
  import { projectBreadcrumb } from "@/components/app/page/breadcrumbs/constants";
  import { pageBreadcrumbsStore } from "@/components/app/page/breadcrumbs/stores";
  import { showToast } from "@/components/ui/toast/index.svelte";
  import { DatasetRecord } from "@/data/model/dataset/dataset-record";
  import { entriesBackendDataSource, EntryRecord } from "@/data/model/dataset/entries/record";
  import { ProjectMemberRecord } from "@/data/model/dataset/projects/members/record";
  import { ProjectRecord } from "@/data/model/dataset/projects/project-record";
  import { ExportsBackendDataSource } from "@/data/model/sync/exports/record";
  import { authStatus } from "@/security/AuthContext";
  import { cn } from "@/utils";
  import { showActionFailedToast } from "@/utils/error/error.toasts";
  import { refetches } from "@/utils/refetch";
  import { pluralizeUnit } from "@/utils/unit";

  import type {
    ColumnSettings,
    FilterDataSourceParams,
    SortDataSourceParams,
  } from "@/components/app/datasource-table/types";
  import type { ListOptions } from "@/data/DataSource";
  import type { CollectionResponse } from "@/data/model/types";
  import type { ProjectMemberScope } from "@/security/types";
  import type { Hash } from "@/utils/types";

  // Contexts
  const project: ProjectRecord = getContext("project");
  const dataset: DatasetRecord = getContext("dataset");

  // Records
  let response: CollectionResponse<EntryRecord> = $state({
    data: [],
    meta: {},
  });

  // Variables
  let projectId: string = page.params.projectId as string;
  let datasetId = page.params.datasetId as string;

  /**
   * Parse filter entries from a URL's searchParams.
   * Handles scalar values (filters[name]=val) and arrays (filters[name][]=val1&filters[name][]=val2).
   */
  function parseUrlFilters(url: URL): Hash {
    const out: Hash = {};
    url.searchParams.forEach((value, key) => {
      const scalarMatch = key.match(/^filters\[([^\]]+)\]$/);
      const arrayMatch = key.match(/^filters\[([^\]]+)\]\[\]$/);
      if (arrayMatch) {
        const k = arrayMatch[1];
        if (!out[k]) out[k] = [];
        (out[k] as unknown[]).push(value);
      } else if (scalarMatch) {
        out[scalarMatch[1]] = value;
      }
    });
    return out;
  }

  /**
   * Serialize filter values into URL search params.
   * Scalar values → filters[key]=val; arrays → filters[key][]=val1&filters[key][]=val2.
   */
  function writeFilterToUrl(params: URLSearchParams, key: string, value: unknown): void {
    params.delete(`filters[${key}]`);
    params.delete(`filters[${key}][]`);
    if (Array.isArray(value)) {
      for (const item of value) {
        params.append(`filters[${key}][]`, String(item));
      }
    } else if (value !== undefined && value !== null) {
      params.set(`filters[${key}]`, String(value));
    }
  }

  // ── View preferences persisted via writable store (matching getTablePreferences pattern) ──

  const viewStateStorageKey = `idah:entries:${datasetId}:viewState`;

  interface ViewPreferences {
    filters: Hash;
    sort: string[];
    itemsPerPage: number;
    currentPage: number;
  }

  const defaultPreferences: ViewPreferences = {
    filters: {},
    sort: ["-created_at"],
    itemsPerPage: 10,
    currentPage: 1,
  };

  // Eagerly initialize from sessionStorage at module scope (browser guard for SSR safety).
  let savedPrefs: ViewPreferences | null = null;
  if (browser) {
    try {
      const raw = sessionStorage.getItem(viewStateStorageKey);
      if (raw) savedPrefs = JSON.parse(raw) as ViewPreferences;
    } catch {
      // Ignore parse errors
    }
  }

  const preferences: Writable<ViewPreferences> = writable<ViewPreferences>(savedPrefs ?? defaultPreferences);

  // Subscribe to auto-persist on any change (only fires in browser)
  const unsub = preferences.subscribe((value) => {
    if (browser) {
      sessionStorage.setItem(viewStateStorageKey, JSON.stringify(value));
    }
  });

  onDestroy(() => unsub());

  // $state variables — separated for reactive Svelte binding
  let urlFilters: Hash = $state({});
  let filters: Hash = $state({ dataset_id: datasetId });
  let _sort: string[] = $state(["-created_at"]);
  let _currentPage: number = $state(1);
  let _itemsPerPage: number = $state(10);

  let canUpdateEntry = $state(false);
  let canDeleteEntry = $state(false);
  let selectedEntryIds: string[] = $state([]);
  let selectedRowsCount: number = $derived(selectedEntryIds.length);
  let assignableEntryIds: string[] = $derived(
    selectedEntryIds.filter((id) => response.data.find((e) => e.id === id)?.wf_step !== "done"),
  );
  let unAssignableEntryIds: string[] = $derived(
    selectedEntryIds.filter((id) => {
      const entry = response.data.find((e) => e.id === id);
      return entry?.wf_step !== "done" && entry?.assigned_to_id !== null;
    }),
  );
  let selectedToUnassignedEntryIdsCount: number = $derived(unAssignableEntryIds.length);
  let openNewEntryModal: boolean = $state(false);
  let openAssignEntryFormModal: boolean = $state(false);
  let openSetPriorityModal: boolean = $state(false);
  let openConfirmUnassignEntriesModal: boolean = $state(false);
  let openConfirmDeleteEntriesModal: boolean = $state(false);
  let openExportModal: boolean = $state(false);

  const as_project_owner: { as_user: ProjectMemberScope } = {
    as_user: {
      projectId,
      projectMemberRoles: ["project_owner"],
    },
  };

  // Lifecycle

  onMount(async () => {
    const currentAccount = $authStatus.authContext;
    canUpdateEntry =
      (await currentAccount?.can("update", "dataset:entries", ["as_org_owner", as_project_owner])) || false;
    canDeleteEntry =
      (await currentAccount?.can("delete", "dataset:entries", ["as_org_owner", as_project_owner])) || false;

    // Sync from store into local $state
    let prefValue: ViewPreferences;
    const unsubInit = preferences.subscribe((v) => (prefValue = v));
    unsubInit();

    _sort = prefValue!.sort;
    _itemsPerPage = prefValue!.itemsPerPage;
    _currentPage = prefValue!.currentPage;

    if (prefValue!.filters && Object.keys(prefValue!.filters).length > 0) {
      urlFilters = { ...prefValue!.filters };
      filters = { dataset_id: datasetId, ...prefValue!.filters };

      // Reconstruct URL search params from saved filters
      const newUrl = new URL(page.url);
      for (const [key, value] of Object.entries(prefValue!.filters)) {
        writeFilterToUrl(newUrl.searchParams, key, value);
      }
      /* eslint-disable svelte/no-navigation-without-resolve */
      goto(newUrl.href, { replaceState: true });
      /* eslint-enable svelte/no-navigation-without-resolve */
    } else {
      // Sync from the current URL
      urlFilters = parseUrlFilters(page.url);
      filters = { dataset_id: datasetId, ...urlFilters };
      persistFilters();
    }

    // Re-fetch with restored state so the list renders with correct filters/sort
    $refetches.entries.list = new Date();
  });

  pageBreadcrumbsStore.set([
    projectBreadcrumb,
    { label: project.name, href: resolve(`/projects/${projectId}/datasets`) },
    { label: "Datasets", href: resolve(`/projects/${projectId}/datasets`) },
    { label: dataset.name, href: resolve(`/projects/${projectId}/datasets/${datasetId}/entries`) },
    { label: "Entries" },
  ]);

  //Derived

  let listOptions: ListOptions = $derived({
    filters: filters,
    included: ["assigned_to", "submitted_by", "reviewed_by"],
    fields: { [ProjectMemberRecord.type]: ["name", "email", "picture_url"] },
    sort: _sort,
    count: true,
    pagination: {
      page: _currentPage,
      itemsPerPage: _itemsPerPage,
    },
  });
  let isFiltering: boolean = $derived(
    Object.keys(listOptions.filters || {}).filter((key) => key !== "dataset_id").length > 0,
  );
  let isRowSelected: boolean = $derived(selectedRowsCount > 0);

  const bulkActions = $derived(
    getEntryDropdownMenuActions({
      onAssign: () => {
        openAssignEntryFormModal = true;
      },
      onUnassign: () => {
        openConfirmUnassignEntriesModal = true;
      },
      onSetPriority: () => {
        openSetPriorityModal = true;
      },
      onDelete: () => {
        openConfirmDeleteEntriesModal = true;
      },
      isAssigned: checkEntriesAssignedToAnyone(selectedEntryIds),
      isAssignDisabled: assignableEntryIds.length === 0,
      isUnassignDisabled: unAssignableEntryIds.length === 0,
    }),
  );

  // Functions

  /** Strip dataset_id from filters before persisting — only user-applied filters are saved. */
  function persistFilters(): void {
    const { dataset_id: _, ...userFilters } = filters as Hash & { dataset_id?: unknown };
    preferences.set({
      filters: userFilters,
      sort: _sort,
      itemsPerPage: _itemsPerPage,
      currentPage: _currentPage,
    });
  }

  function checkEntriesAssignedToAnyone(entryIds: string[]): boolean {
    return response.data.some((entry) => entryIds.includes(entry.id) && !!entry.assigned_to_id);
  }

  function openNewEntryFormModal(): void {
    openNewEntryModal = true;
  }

  async function fetchEntries(): Promise<void> {
    response = await entriesBackendDataSource.list(listOptions);
  }

  function resetToFirstPage(): void {
    _currentPage = 1;
  }

  async function filterEntries(params: FilterDataSourceParams): Promise<void> {
    const newUrl = new URL(page.url);
    let updatedFilters = { ...filters };

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
    goto(newUrl.href, { replaceState: true });
    /* eslint-enable svelte/no-navigation-without-resolve */

    resetToFirstPage();

    urlFilters = parseUrlFilters(newUrl);
    filters = updatedFilters;

    persistFilters();
    $refetches.entries.list = new Date();
  }

  async function sortEntries(params: SortDataSourceParams): Promise<void> {
    const { columnKey, sortDirection } = params;
    const sortPrefix = sortDirection === "desc" ? "-" : "";
    const sortKey = `${sortPrefix}${columnKey}`;

    if (sortDirection === "none") {
      _sort = _sort.filter((s) => !s.endsWith(sortKey));
    } else if (_sort.some((s) => s.endsWith(columnKey))) {
      _sort = _sort.map((s) => (s.endsWith(columnKey) ? sortKey : s));
    } else {
      _sort = [..._sort, sortKey];
    }

    resetToFirstPage();
    persistFilters();
    $refetches.entries.list = new Date();
  }

  async function changePage(changeToPage: number): Promise<void> {
    _currentPage = changeToPage;
    persistFilters();
    $refetches.entries.list = new Date();
  }

  async function setItemsPerPage(selectedItemsPerPage: number): Promise<void> {
    resetToFirstPage();
    _itemsPerPage = selectedItemsPerPage;
    persistFilters();
    $refetches.entries.list = new Date();
  }

  function selectRow(selectedId: string): void {
    if (selectedEntryIds.includes(selectedId)) {
      selectedEntryIds = selectedEntryIds.filter((id) => id !== selectedId);
    } else {
      selectedEntryIds = [...selectedEntryIds, selectedId];
    }
  }

  async function unAssignEntries(): Promise<void> {
    try {
      for (const entryId of unAssignableEntryIds) {
        const entryRes = await entriesBackendDataSource.update(entryId, {
          attributes: { assigned_to_id: null },
        });
        response.data = response.data.map((entry) => (entry.id === entryId ? entryRes.data : entry));
      }

      const selectedToUnassignedRows = response.data.filter((entry) => unAssignableEntryIds.includes(entry.id));
      const description =
        selectedToUnassignedRows.length > 1
          ? `${selectedToUnassignedRows.length} entries have been unassigned.`
          : `The entry "${selectedToUnassignedRows[0]?.name}" has been unassigned.`;

      showToast.success({ title: "Entry unassigned", description });
      selectedEntryIds = [];
      $refetches.entries.list = new Date();
      openConfirmUnassignEntriesModal = false;
    } catch (error) {
      showActionFailedToast(error);
    }
  }

  async function deleteEntries(): Promise<void> {
    try {
      for (const entryId of selectedEntryIds) {
        await entriesBackendDataSource.delete(entryId, { showErrorToast: false });
      }

      const description =
        selectedRowsCount > 1
          ? `${selectedRowsCount} entries have been deleted.`
          : `The entry "${response.data.find((entry) => entry.id === selectedEntryIds[0])?.resource}" has been deleted.`;

      showToast.success({ title: "Entry deleted", description });
      selectedEntryIds = [];
      $refetches.entries.list = new Date();
      openConfirmDeleteEntriesModal = false;
    } catch (error) {
      showToast.error({
        title: "Unable to delete entry",
        description: error?.errors[0]?.detail || "The action could not be completed, please try again later.",
      });
    }
  }

  async function exportEntries(): Promise<void> {
    await ExportsBackendDataSource.export({
      datasets: { id: datasetId },
      entries: { id__in: selectedEntryIds },
    });
    selectedEntryIds = [];
    openExportModal = false;
  }

  function toggleSelectAll(checked: boolean): void {
    if (checked) {
      selectedEntryIds = response.data.map((entry) => entry.id);
    } else {
      selectedEntryIds = [];
    }
  }

  function resetSelectedRows(): void {
    selectedEntryIds = [];
    $refetches.entries.list = new Date();
  }
</script>

{#snippet AddEntryButton(className?: string)}
  <Can action="create" resource="dataset:entries" scopes={["as_org_owner", as_project_owner]}>
    <Button onclick={openNewEntryFormModal} class={className}>
      <PlusIcon />
      Add Entry
    </Button>
  </Can>
{/snippet}

<PageHeader title="Datasets">
  {#snippet slotTitle()}
    <div class="flex w-full gap-4">
      <div class="flex w-full flex-col items-center justify-between gap-4 lg:flex-row">
        <div class="flex flex-1 items-center gap-4">
          <!-- SELECT ALL -->
          {#if canUpdateEntry || canDeleteEntry}
            <div class="pl-6">
              <Checkbox checked={selectedEntryIds.length > 0} onCheckedChange={toggleSelectAll} />
            </div>
          {/if}

          <div class="flex flex-wrap gap-2">
            {#each Object.entries(entryColumns) as [columnKey, columnSetting] (columnKey)}
              <FilterSortDropdownMenu
                contexts={{ projectId: page.params.projectId }}
                {columnKey}
                columnSetting={columnSetting as ColumnSettings<EntryRecord>}
                filters={listOptions.filters || {}}
                sort={listOptions.sort || []}
                onFilter={filterEntries}
                onSort={sortEntries}
                onHide={() => {}}
              >
                {#snippet trigger({ label, sortable, isSorting, isSortingAsc, isSortingDesc, filterable, isFiltering })}
                  <Button
                    variant={isFiltering || isSorting ? "default" : "outline"}
                    class={cn(
                      "data-[state=open]:bg-primary data-[state=open]:text-primary-foreground hover:bg-primary hover:text-primary-foreground my-2 w-full min-w-40 gap-2 font-normal",
                      isFiltering || isSorting ? "text-primary-foreground" : "text-muted-foreground",
                    )}
                  >
                    {#if isFiltering}
                      <FunnelIcon class="size-4" />
                    {/if}

                    <span class="mr-auto">{label}</span>

                    {#if sortable || filterable}
                      {#if isSortingAsc}
                        <ArrowDownAZIcon class="size-4" />
                      {:else if isSortingDesc}
                        <ArrowDownZAIcon class="size-4" />
                      {:else}
                        <ArrowUpDownIcon class="size-4" />
                      {/if}
                    {/if}
                  </Button>
                {/snippet}
              </FilterSortDropdownMenu>
            {/each}
          </div>
        </div>

        <div class={cn("w-full gap-2 lg:w-auto", isRowSelected ? "grid grid-cols-2" : "flex justify-end")}>
          <!-- BULK ACTIONS -->

          {#if isRowSelected}
            <DropdownMenu>
              <DropdownMenuTrigger>
                <Button variant="outline" class="bg-primary/10 hover:bg-primary/20 w-full transition-opacity">
                  {selectedRowsCount} selected
                  <ChevronsUpDownIcon class="text-muted-foreground ml-2 size-4" />
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent>
                <DropdownMenuGroup>
                  {#each bulkActions as { label, icon: Icon, action, disabled, hidden }, index (index)}
                    {#if !hidden}
                      <DropdownMenuItem {disabled} onclick={action}>
                        <Icon class="mr-2 size-4" />
                        {label}
                      </DropdownMenuItem>
                    {/if}
                  {/each}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          {/if}

          {@render AddEntryButton("w-full lg:w-auto")}
        </div>
      </div>
    </div>
  {/snippet}
</PageHeader>

<!-- LIST OF TASKS (ENTRY) -->
{#key $refetches.entries.list}
  {#await fetchEntries()}
    <Spinner />
  {:then _}
    <div class="flex flex-col gap-4">
      {#each response.data as entry (entry.id)}
        <EntryCard {entry} {selectedEntryIds} onRowSelect={selectRow} />
      {:else}
        <Card>
          <CardContent class="min-h-64 flex items-center justify-center">
            <ResponseBlock
              icon={LayoutListIcon}
              title={isFiltering ? "No entries found" : "No entries yet"}
              description={isFiltering ? "Try adjusting your filters." : "Please add entries to get started."}
            >
              {#snippet actions()}
                {#if !isFiltering}
                  {@render AddEntryButton()}
                {/if}
              {/snippet}
            </ResponseBlock>
          </CardContent>
        </Card>
      {/each}
    </div>

    <AppPaginator
      page={listOptions.pagination?.page || _currentPage}
      itemsPerPage={listOptions.pagination?.itemsPerPage || _itemsPerPage}
      count={response.meta?.count ?? 0}
      hasMore={response.meta?.more || false}
      onPageChange={changePage}
      onItemsPerPageSelect={setItemsPerPage}
    />
  {/await}
{/key}

<!-- MODAL::ADD TASK -->
<UploadEntryFormModal title="Entry" action="create" modality={dataset.modality} bind:open={openNewEntryModal} />

<!-- MODAL::ASSIGN ANNOTATOR  -->
<AssignEntryFormModal
  action="update"
  entryIds={assignableEntryIds}
  onAssigned={resetSelectedRows}
  entryRecord={assignableEntryIds.length === 1
    ? response.data.find((entry) => entry.id === assignableEntryIds[0])
    : undefined}
  bind:open={openAssignEntryFormModal}
/>

<!-- MODAL::SET PRIORITY -->
<UpdateEntryPriorityFormModal action="update" entryIds={selectedEntryIds} bind:open={openSetPriorityModal} />

<!-- MODAL::CONFIRM UNASSIGN -->
<ConfirmModal
  title="Unassign entry"
  description={`Are you sure you want to unassign ${selectedToUnassignedEntryIdsCount} ${pluralizeUnit(selectedToUnassignedEntryIdsCount, "entry", "entries")}?`}
  onConfirm={unAssignEntries}
  bind:open={openConfirmUnassignEntriesModal}
/>

<!-- MODAL::CONFIRM DELETE -->
<ConfirmModal
  title="Delete entry"
  description={`Are you sure you want to delete ${selectedRowsCount} ${pluralizeUnit(selectedRowsCount, "entry", "entries")}? This action cannot be undone.`}
  onConfirm={deleteEntries}
  bind:open={openConfirmDeleteEntriesModal}
/>

<ConfirmModal
  title="Export {selectedRowsCount} entries(s)"
  description="Are you sure you want to export {selectedRowsCount} entries(s)?"
  onConfirm={exportEntries}
  bind:open={openExportModal}
/>
