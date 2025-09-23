<script lang="ts">
  import { page } from "$app/state";

  import Button from "@/components/ui/button/button.svelte";
  import DataTable from "@/components/app/data-table/data-table.svelte";
  import DatasetFormModal from "@/components/app/datasets/overlays/dataset-form-modal.svelte";
  import PageHeader from "@/components/app/page/page-header.svelte";

  import { projectDatasetColumns } from "@/components/app/datasets/data-tables/project-dataset.columns";
  import { datasetsBackendDataSource } from "@/data/model/dataset/dataset-record";
  import { refetches } from "@/utils/refetch";
  import { FileDownIcon, PlusIcon } from "@lucide/svelte";

  // Variables
  let projectId: string = page.params.projectId as string;
  let openNewDatasetModal: boolean = $state(false);
</script>

<PageHeader title="Datasets">
  {#snippet actions()}
    <div class="flex items-center gap-4">
      <Button onclick={() => (openNewDatasetModal = true)}>
        <PlusIcon class="size-4" />
        New Dataset
      </Button>
      <Button> <!-- open file import modal and call import -->
        <FileDownIcon class="size-4" />
        Import Dataset
      </Button>
    </div>
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
        "dataset:datasets": ["name", "status", "modality", "progress", "created_at", "updated_at"],
        "dataset:projects": ["name"],
      },
      filters: {
        project_id: projectId,
      },
      sort: ["-created_at"],
    }}
  />
{/key}

<DatasetFormModal title="Dataset" action="create" bind:open={openNewDatasetModal} />
