<script lang="ts">
  import { page } from "$app/state";

  import Button from "@/components/ui/button/button.svelte";
  import DataTable from "@/components/app/data-table/data-table.svelte";
  import DatasetFormModal from "@/components/app/datasets/overlays/dataset-form-modal.svelte";
  import PageHeader from "@/components/app/page/page-header.svelte";

  import { projectDatasetColumns } from "@/components/app/datasets/data-tables/project-dataset.columns";
  import { DatasetRecord, datasetsBackendDataSource } from "@/data/model/dataset/dataset-record";
  import { EntryRecord } from "@/data/model/dataset/entries/record";
  import { ProjectRecord } from "@/data/model/dataset/projects/project-record";
  import { refetches } from "@/utils/refetch";
  import { PlusIcon } from "@lucide/svelte";

  import type { Record } from "@/data/model/Record";

  // Variables
  let projectId: string = page.params.projectId as string;
  let openNewDatasetModal: boolean = $state(false);
</script>

<PageHeader title="Datasets">
  {#snippet actions()}
    <Button onclick={() => (openNewDatasetModal = true)}>
      <PlusIcon class="size-4" />
      New Dataset
    </Button>
  {/snippet}
</PageHeader>

{#key $refetches.datasets.list}
  <DataTable
    id="datasets"
    name="dataset"
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
  />
{/key}

<DatasetFormModal title="Dataset" action="create" bind:open={openNewDatasetModal} />
