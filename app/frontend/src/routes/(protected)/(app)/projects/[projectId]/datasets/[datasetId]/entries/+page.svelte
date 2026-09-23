<script lang="ts">
  import { page } from "$app/state";
  import { LayoutListIcon } from "@lucide/svelte";
  import { getContext, onMount } from "svelte";

  import { resolve } from "$app/paths";

  import ResponseBlock from "@/components/app/blocks/response-block.svelte";
  import DataView from "@/components/app/data-view/data-view.svelte";
  import EntryCard from "@/components/app/datasets/entries/cards/entry-card.svelte";
  import PageHeader from "@/components/app/page/page-header.svelte";

  import UploadEntryButton from "@/components/app/datasets/entries/button/_UploadEntryButton.svelte";
  import EntriesFilterToolbar from "@/components/app/datasets/entries/toolbar/_EntryFilterToolbar.svelte";

  import { projectBreadcrumb } from "@/components/app/page/breadcrumbs/constants";
  import { pageBreadcrumbsStore } from "@/components/app/page/breadcrumbs/stores";

  import { createEntriesController } from "@/components/app/datasets/entries/overlays/entries-list.svelte";
  import { EntrySelection } from "@/components/app/datasets/entries/util/entry-selection.svelte";
  import { DatasetRecord } from "@/data/model/dataset/dataset-record";
  import { ProjectRecord } from "@/data/model/dataset/projects/project-record";
  import { authStatus } from "@/security/AuthContext";

  import type { ProjectMemberScope } from "@/security/types";

  // Contexts
  const project: ProjectRecord = getContext("project");
  const dataset: DatasetRecord = getContext("dataset");

  const projectId = page.params.projectId as string;
  const datasetId = page.params.datasetId as string;

  // Workflow name from the dataset for filtering by workflow stage
  const workflowName = dataset.workflow_name ?? "default";

  // Controller owns all list state, fetching, URL sync, and persistence
  // const controller = new EntriesListController(datasetId);
  // Generic list controller (owns filters/sort/pagination/url-sync/persistence/refetch);
  // DataView drives its lifecycle. Entry-specific derivations live in EntrySelection.
  const controller = createEntriesController(datasetId);
  const sel = new EntrySelection(controller);

  // Auth-gated flags (resolved on mount)
  let canUpdateEntry = $state(false);
  let canDeleteEntry = $state(false);

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

  onMount(async () => {
    const account = $authStatus.authContext;
    [canUpdateEntry, canDeleteEntry] = await Promise.all([
      account?.can("update", "dataset:entries", ["as_org_owner", as_project_owner]) || Promise.resolve(false),
      account?.can("delete", "dataset:entries", ["as_org_owner", as_project_owner]) || Promise.resolve(false),
    ]);
  });
</script>

<PageHeader title="Datasets">
  {#snippet slotTitle()}
    <EntriesFilterToolbar {controller} {sel} {canUpdateEntry} {canDeleteEntry} {projectId} {workflowName} />
  {/snippet}
</PageHeader>

<DataView {controller}>
  {#snippet DataSlot({ record })}
    <EntryCard
      entry={record}
      selectedEntryIds={controller.selectedIds}
      onRowSelect={controller.toggleSelect.bind(controller)}
      onEntryUpdated={controller.fetch.bind(controller)}
    />
  {/snippet}

  {#snippet EmptyState({ isFiltering })}
    <ResponseBlock
      icon={LayoutListIcon}
      title={isFiltering ? "No entries found" : "No entries yet"}
      description={isFiltering ? "Try adjusting your filters." : "Please add entries to get started."}
    >
      {#snippet actions()}
        {#if !isFiltering}
          <UploadEntryButton />
        {/if}
      {/snippet}
    </ResponseBlock>
  {/snippet}
</DataView>
