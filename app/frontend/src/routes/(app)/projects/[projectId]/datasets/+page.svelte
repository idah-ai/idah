<script lang="ts">
  import { resolve } from "$app/paths";
  import { page } from "$app/state";

  import { getContext, onMount } from "svelte";

  import AddNewDatasetButton from "@/components/app/datasets/buttons/add-new-dataset-button.svelte";
  import DatasourceTable from "@/components/app/datasource-table/datasource-table.svelte";

  import { projectDatasetColumns } from "@/components/app/datasets/datasource-tables/project-dataset.columns";
  import { projectBreadcrumb } from "@/components/app/page/breadcrumbs/constants";
  import { pageBreadcrumbsStore } from "@/components/app/page/breadcrumbs/stores";
  import { DatasetRecord, datasetsBackendDataSource } from "@/data/model/dataset/dataset-record";
  import { EntryRecord } from "@/data/model/dataset/entries/record";
  import { ProjectRecord } from "@/data/model/dataset/projects/project-record";
  import { authStatus } from "@/security/AuthContext";
  import { refetches } from "@/utils/refetch";

  import type { ProjectMemberScope } from "@/security/types";

  // Contexts
  const project: ProjectRecord = getContext("project");

  // Variables
  let projectId: string = page.params.projectId as string;
  let canUpdateDataset = $state(false);
  let canDeleteDataset = $state(false);
  let canExport = $state(false);
  let columns = $state(projectDatasetColumns);

  pageBreadcrumbsStore.set([
    projectBreadcrumb,
    { label: project.name, href: resolve(`/projects/${projectId}/datasets`) },
    { label: "Datasets" },
  ]);

  // Lifecycle
  onMount(async () => {
    const currentAccount = $authStatus.authContext;
    const as_project_owner: { as_user: ProjectMemberScope } = {
      as_user: {
        projectId,
        projectMemberRoles: ["project_owner"],
      },
    };

    canUpdateDataset =
      (await currentAccount?.can("update", "dataset:datasets", ["as_org_owner", as_project_owner])) || false;
    canDeleteDataset =
      (await currentAccount?.can("delete", "dataset:datasets", ["as_org_owner", as_project_owner])) || false;
    canExport =
      (await currentAccount?.can("request_export", "sync:exports", ["as_org_owner", as_project_owner])) || false;
    columns.action.visible = canUpdateDataset || canDeleteDataset || canExport;
  });
</script>

{#key $refetches.datasets.list}
  <DatasourceTable
    id={`projects:${projectId}:datasets`}
    name="dataset"
    refetchKey="datasets"
    {columns}
    dataSource={datasetsBackendDataSource}
    listOptions={{
      fields: {
        [DatasetRecord.type]: ["name", "status", "modality", "progress", "created_at", "updated_at"],
        [ProjectRecord.type]: ["name"],
        [EntryRecord.type]: ["status"],
      },
      filters: {
        project_id: projectId,
      },
      included: ["entries"],
      sort: ["-created_at"],
    }}
  >
    {#snippet addNewRecordButton()}
      <AddNewDatasetButton />
    {/snippet}
  </DatasourceTable>
{/key}
