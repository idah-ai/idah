<script lang="ts">
  import { page } from "$app/state";
  import { LayoutListIcon } from "@lucide/svelte";
  import { getContext, onDestroy, onMount } from "svelte";

  import { resolve } from "$app/paths";

  import ResponseBlock from "@/components/app/blocks/response-block.svelte";
  import EntryCard from "@/components/app/datasets/entries/cards/entry-card.svelte";
  import PageHeader from "@/components/app/page/page-header.svelte";
  import AppPaginator from "@/components/app/paginators/app-paginator.svelte";
  import Button from "@/components/ui/button/button.svelte";
  import Spinner from "@/components/ui/spinner/spinner.svelte";
  import Can from "@/security/can.svelte";

  import EntriesModals from "@/components/app/datasets/entries/overlays/entry-handle-modals.svelte";
  import EntriesFilterToolbar from "@/components/app/datasets/entries/toolbar/entry-filter-toolbar.svelte";

  import { Card, CardContent } from "@/components/ui/card";

  import { projectBreadcrumb } from "@/components/app/page/breadcrumbs/constants";
  import { pageBreadcrumbsStore } from "@/components/app/page/breadcrumbs/stores";

  import { EntriesListController } from "@/components/app/datasets/entries/overlays/entries-list.svelte";
  import { DatasetRecord } from "@/data/model/dataset/dataset-record";
  import { ProjectRecord } from "@/data/model/dataset/projects/project-record";
  import { authStatus } from "@/security/AuthContext";

  import type { ProjectMemberScope } from "@/security/types";

  // Contexts
  const project: ProjectRecord = getContext("project");
  const dataset: DatasetRecord = getContext("dataset");

  const projectId = page.params.projectId as string;
  const datasetId = page.params.datasetId as string;

  // Controller owns all list state, fetching, URL sync, and persistence
  const controller = new EntriesListController(datasetId);

  // Auth-gated flags (resolved on mount)
  let canUpdateEntry = $state(false);
  let canDeleteEntry = $state(false);

  // Modal visibility
  let openNewEntry = $state(false);
  let openAssignEntry = $state(false);
  let openSetPriority = $state(false);
  let openConfirmUnassign = $state(false);
  let openConfirmDelete = $state(false);
  let openExport = $state(false);

  const as_project_owner: { as_user: ProjectMemberScope } = {
    as_user: { projectId, projectMemberRoles: ["project_owner"] },
  };

  pageBreadcrumbsStore.set([
    projectBreadcrumb,
    { label: project.name, href: resolve(`/projects/${projectId}/datasets`) },
    { label: "Datasets", href: resolve(`/projects/${projectId}/datasets`) },
    { label: dataset.name, href: resolve(`/projects/${projectId}/datasets/${datasetId}/entries`) },
    { label: "Entries" },
  ]);

  let unsubRefetch: (() => void) | undefined;

  onMount(async () => {
    const account = $authStatus.authContext;
    [canUpdateEntry, canDeleteEntry] = await Promise.all([
      account?.can("update", "dataset:entries", ["as_org_owner", as_project_owner]) || Promise.resolve(false),
      account?.can("delete", "dataset:entries", ["as_org_owner", as_project_owner]) || Promise.resolve(false),
    ]);

    await controller.initFromUrl();
    unsubRefetch = controller.subscribeToRefetches();
  });

  onDestroy(() => {
    unsubRefetch?.();
    controller.destroy();
  });
</script>

<PageHeader title="Datasets">
  {#snippet slotTitle()}
    <EntriesFilterToolbar
      {controller}
      {canUpdateEntry}
      {canDeleteEntry}
      {projectId}
      {as_project_owner}
      onOpenNewEntry={() => (openNewEntry = true)}
      onOpenAssign={() => (openAssignEntry = true)}
      onOpenUnassign={() => (openConfirmUnassign = true)}
      onOpenSetPriority={() => (openSetPriority = true)}
      onOpenDelete={() => (openConfirmDelete = true)}
    />
  {/snippet}
</PageHeader>

<!-- ENTRY LIST -->
<div class="flex flex-col gap-4" class:opacity-60={controller.isFetching}>
  {#each controller.response.data as entry (entry.id)}
    <EntryCard
      {entry}
      selectedEntryIds={controller.selectedEntryIds}
      onRowSelect={controller.selectRow.bind(controller)}
      onEntryUpdated={controller.fetch.bind(controller)}
    />
  {:else}
    <Card>
      <CardContent class="min-h-64 flex items-center justify-center">
        {#if controller.isFetching}
          <Spinner />
        {:else}
          <ResponseBlock
            icon={LayoutListIcon}
            title={controller.isFiltering ? "No entries found" : "No entries yet"}
            description={controller.isFiltering ? "Try adjusting your filters." : "Please add entries to get started."}
          >
            {#snippet actions()}
              {#if !controller.isFiltering}
                <Can action="create" resource="dataset:entries" scopes={["as_org_owner", as_project_owner]}>
                  <Button onclick={() => (openNewEntry = true)}>Add Entry</Button>
                </Can>
              {/if}
            {/snippet}
          </ResponseBlock>
        {/if}
      </CardContent>
    </Card>
  {/each}
</div>

<AppPaginator
  page={controller.currentPage}
  itemsPerPage={controller.itemsPerPage}
  count={controller.response.meta?.count ?? 0}
  hasMore={controller.response.meta?.more || false}
  onPageChange={controller.changePage.bind(controller)}
  onItemsPerPageSelect={controller.setItemsPerPage.bind(controller)}
/>

<EntriesModals
  {controller}
  {datasetId}
  bind:openNewEntry
  bind:openAssignEntry
  bind:openSetPriority
  bind:openConfirmUnassign
  bind:openConfirmDelete
  bind:openExport
/>