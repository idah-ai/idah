<script lang="ts">
  import { resolve } from "$app/paths";
  import { page } from "$app/state";

  import { getContext } from "svelte";

  import AddNewDatasetButton from "@/components/app/datasets/buttons/add-new-dataset-button.svelte";
  import DatasourceTable from "@/components/app/datasource-table/datasource-table.svelte";

  import { projectDatasetColumns } from "@/components/app/datasets/datasource-tables/project-dataset.columns";
  import { homeBreadcrumb, projectBreadcrumb } from "@/components/app/page/breadcrumbs/constants";
  import { pageBreadcrumbsStore } from "@/components/app/page/breadcrumbs/stores";
  import { DatasetRecord, datasetsBackendDataSource } from "@/data/model/dataset/dataset-record";
  import { EntryRecord } from "@/data/model/dataset/entries/record";
  import { ProjectRecord } from "@/data/model/dataset/projects/project-record";
  import { refetches } from "@/utils/refetch";

  // Contexts
  const project: ProjectRecord = getContext("project");

  // Variables
  let projectId: string = page.params.projectId as string;

  pageBreadcrumbsStore.set([
    homeBreadcrumb,
    projectBreadcrumb,
    { label: project.name, href: resolve(`/projects/${projectId}/datasets`) },
    { label: "Datasets" },
  ]);
</script>

{#key $refetches.datasets.list}
  <DatasourceTable
    id="datasets"
    name="dataset"
    refetchKey="datasets"
    columns={projectDatasetColumns}
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
