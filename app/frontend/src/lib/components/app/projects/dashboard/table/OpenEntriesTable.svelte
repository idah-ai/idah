<script lang="ts">
  import { onMount, onDestroy, untrack } from "svelte";
  import { ArrowDownUpIcon } from "@lucide/svelte";
  import AppTable from "@/components/app/table/table.svelte";
  import AppTableHeader from "@/components/app/table/tableHeader.svelte";
  import AppTableBody from "@/components/app/table/tableBody.svelte";
  import { Button } from "@/components/ui/button";
  import { Badge } from "@/components/ui/badge";
  import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
  import OpenEntryRow from "@/components/app/projects/dashboard/table/OpenEntryRow.svelte";
  import { openEntryColumns } from "@/components/app/projects/dashboard/table/OpenEntry.columns";
  import {
    entryTabs,
    entryTab,
    entryTabFilters,
    normalizeEntryPreferences,
    type EntryTab,
  } from "@/components/app/projects/dashboard/EntryTable";

  import type { EntryRecord } from "@/data/model/dataset/entries/record";
  import type { Counts, ProjectDashboardDataSources } from "@/components/app/projects/dashboard/DashboardData";
  import type { Writable } from "svelte/store";
  import type { TablePreferences } from "@/components/app/datasource-table/types";
  import type { CollectionResponse } from "@/data/model/types";

  // Props
  let {
    sources,
    ids,
    combined,
    preferences,
    counts = null,
  }: {
    sources: ProjectDashboardDataSources;
    ids: string[];
    combined: boolean;
    preferences: Writable<TablePreferences>;
    counts?: Counts | null;
  } = $props();

  untrack(() => preferences.update(normalizeEntryPreferences));

  // Variables
  const activeTab = $derived(entryTab($preferences.filters) ?? "All");
  const tabCounts = $derived(
    counts
      ? {
          All: counts.total,
          Open: counts.reviewing + counts.pendingReview + counts.annotating + counts.pendingAnnotation,
          Completed: counts.completed,
        }
      : null,
  );
  const tableColumns = $derived(openEntryColumns(combined));
  const headers = $derived(
    tableColumns.map((column) => ({
      ...column,
      ...(column.id === "time" ? { content: timeHeader } : {}),
    })),
  );
  const dataSource = untrack(() => sources.openEntries(ids, combined));
  let response: CollectionResponse<EntryRecord> = $state.raw({ data: [], meta: {} });
  let contexts: { datasetNames?: { [id: string]: string } } = $state.raw({});
  let status: "loading" | "ready" | "error" = $state("loading");
  let error = $state("");
  let expandedIds: string[] = $state([]);
  const allExpanded = $derived(
    response.data.length > 0 && response.data.every((record) => expandedIds.includes(record.id)),
  );
  let generation = 0;

  onMount(() => {
    void load();
  });
  onDestroy(() => {
    generation++;
  });

  async function load(): Promise<void> {
    const token = ++generation;
    status = "loading";
    error = "";
    expandedIds = [];
    const pagination = { ...$preferences.pagination };
    const filters = entryTabFilters(activeTab);
    try {
      const result = await dataSource.list({ pagination, filters, sort: [...$preferences.sort], count: true });
      if (token !== generation) return;
      response = result;
      contexts = dataSource.contexts(result);
      status = "ready";
    } catch (reason) {
      if (token !== generation) return;
      error = reason instanceof Error ? reason.message : "Unable to load entries.";
      status = "error";
    }
  }
  async function changeTab(value: string): Promise<void> {
    if (!entryTabs.includes(value as EntryTab) || value === activeTab) return;
    preferences.update((prefs) => ({
      ...prefs,
      filters: entryTabFilters(value as EntryTab),
      pagination: { ...prefs.pagination, page: 1 },
    }));
    await load();
  }
  async function changePage(page: number): Promise<void> {
    preferences.update((prefs) => ({ ...prefs, pagination: { ...prefs.pagination, page } }));
    await load();
  }
  async function changePageSize(itemsPerPage: number): Promise<void> {
    preferences.update((prefs) => ({ ...prefs, pagination: { page: 1, itemsPerPage } }));
    await load();
  }
  function setExpanded(id: string, open: boolean): void {
    expandedIds = open
      ? [...expandedIds.filter((value) => value !== id), id]
      : expandedIds.filter((value) => value !== id);
  }
</script>

{#snippet timeHeader()}
  <Button
    variant="ghost"
    size="sm"
    class="h-auto px-0 text-xs"
    disabled
    title="Sorting is unavailable until recorded time is available."
  >
    {tableColumns.find((column) => column.id === "time")?.label}
    <ArrowDownUpIcon class="size-3" />
  </Button>
{/snippet}

<Tabs value={activeTab} onValueChange={changeTab}>
  <div class="flex flex-wrap items-center justify-between gap-3 px-6">
    <TabsList aria-label="Filter entries">
      {#each entryTabs as tab (tab)}
        <TabsTrigger value={tab}>
          {tab}<Badge variant="secondary" class="ml-1 rounded-full px-1.5 text-xs"
            >{tabCounts?.[tab]?.toLocaleString() ?? "—"}</Badge
          >
        </TabsTrigger>
      {/each}
    </TabsList>
    <Button
      variant="link"
      size="sm"
      class="h-auto px-0"
      disabled={status !== "ready" || !response.data.length}
      title="Applies only to entries on this page"
      onclick={() => {
        expandedIds = allExpanded ? [] : response.data.map((record) => record.id);
      }}
    >
      {allExpanded ? "Collapse all" : "Expand all"}
    </Button>
  </div>
  <TabsContent value={activeTab}>
    <AppTable
      label="Progress by entry"
      class={combined ? "min-w-[760px]" : "min-w-[640px]"}
      loading={status === "loading"}
      pagination={{
        page: $preferences.pagination.page,
        itemsPerPage: $preferences.pagination.itemsPerPage,
        count: response.meta?.count ?? 0,
        hasMore: response.meta?.more === true,
        onPageChange: changePage,
        onItemsPerPageSelect: changePageSize,
      }}
    >
      <AppTableHeader columns={headers} />
      <AppTableBody
        {status}
        label="Entries"
        colspan={tableColumns.length}
        empty={response.data.length === 0}
        {error}
        onRetry={load}
      >
        {#each response.data as record (record.id)}
          <OpenEntryRow
            {record}
            {contexts}
            columns={tableColumns}
            expanded={expandedIds.includes(record.id)}
            onExpandedChange={(open) => setExpanded(record.id, open)}
          />
        {/each}
      </AppTableBody>
    </AppTable>
  </TabsContent>
</Tabs>
