<script lang="ts">
  import Button from "@/components/ui/button/button.svelte";
  import DataTable from "@/components/app/data-table/data-table.svelte";
  import PageProvider from "@/components/app/page/page-provider.svelte";
  import PageHeader from "@/components/app/page/page-header.svelte";
  import DatasetFormModal from "@/components/app/projects/overlays/dataset-form-modal.svelte";
  import { PlusIcon } from "@lucide/svelte";
  import { page } from "$app/state";

  import { projectBreadcrumb } from "@/components/app/page/page-breadcrumb.constants";
  import { projectDatasetColumns } from "@/components/app/datasets/data-tables/project-dataset.columns";
  import { datasetsBackendDataSource } from "@/data/model/dataset/dataset-record";
  import { refetches } from "@/utils/refetch";

  import type { PageBreadcrumbItem } from "@/components/app/page/page-breadcrumb.svelte";

  // Variables
  let projectId: string = page.params.projectId as string;
  let openNewDatasetModal: boolean = $state(false);
  // let breadcrumbs: PageBreadcrumbItem[] = $state([projectBreadcrumb]);
</script>


<PageHeader title="datasets">
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
        "dataset:datasets": ["name", "status", "modality","progress", "created_at", "updated_at"],
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
