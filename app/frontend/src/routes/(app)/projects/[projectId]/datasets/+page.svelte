<script lang="ts">
  import { page } from "$app/state";
  import { PlusIcon } from "@lucide/svelte";

  import DatasetFormModal from "@/components/app/datasets/overlays/dataset-form-modal.svelte";
  import DatasourceTable from "@/components/app/datasource-table/datasource-table.svelte";
  import Button from "@/components/ui/button/button.svelte";

  import { projectDatasetColumns } from "@/components/app/datasets/datasource-tables/project-dataset.columns";
  import { DatasetRecord, datasetsBackendDataSource } from "@/data/model/dataset/dataset-record";
  import { EntryRecord } from "@/data/model/dataset/entries/record";
  import { ProjectRecord } from "@/data/model/dataset/projects/project-record";
  import { refetches } from "@/utils/refetch";

  // Variables
  let projectId: string = page.params.projectId as string;
  let openNewDatasetModal: boolean = $state(false);
</script>

{#snippet AddNewDatasetButton()}
  <Button onclick={() => (openNewDatasetModal = true)}>
    <PlusIcon class="size-4" />
    New Dataset
  </Button>
{/snippet}

{#key $refetches.datasets.list}
  <DatasourceTable
    id="datasets"
    name="dataset"
    title="Datasets"
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
    {#snippet actions()}
      {@render AddNewDatasetButton()}
    {/snippet}

    {#snippet addNewRecordButton()}
      {@render AddNewDatasetButton()}
    {/snippet}
  </DatasourceTable>
{/key}

<DatasetFormModal title="Dataset" action="create" bind:open={openNewDatasetModal} />
