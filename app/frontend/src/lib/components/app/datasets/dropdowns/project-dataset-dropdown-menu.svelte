<script lang="ts">
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { EllipsisVerticalIcon, SquarePenIcon, Trash2Icon } from "@lucide/svelte";

  import DatasetFormModal from "@/components/app/datasets/overlays/dataset-form-modal.svelte";
  import DropdownMenus from "@/components/app/dropdown-menus/dropdown-menus.svelte";
  import ConfirmModal from "@/components/app/overlays/modals/confirm-modal.svelte";
  import Button from "@/components/ui/button/button.svelte";

  import { DatasetRecord, datasetsBackendDataSource } from "@/data/model/dataset/dataset-record";
  import { refetches } from "@/utils/refetch";

  import type { IDropdownMenus } from "@/components/app/dropdown-menus/types";

  // Props
  interface Props {
    datasetId: string;
    projectId: string;
  }
  let { datasetId, projectId }: Props = $props();

  // Variables
  const menus: IDropdownMenus = {
    actions: {
      items: [
        {
          label: "Edit",
          icon: SquarePenIcon,
          action: async () => {
            const datasetRes = await fetchDataset();

            datasetRecord = datasetRes.data;
            openEditDatasetFormModal = true;
          },
        },
        {
          label: "Delete",
          icon: Trash2Icon,
          action: () => {
            openConfirmDeleteDatasetModal = true;
          },
        },
      ],
    },
  };

  let datasetRecord: DatasetRecord | undefined = $state(undefined);
  let openEditDatasetFormModal: boolean = $state(false);
  let openConfirmDeleteDatasetModal: boolean = $state(false);
  let openExportDatasetModal: boolean = $state(false);

  // Functions
  async function fetchDataset() {
    return await datasetsBackendDataSource.get(datasetId, {
      fields: {
        "datasets:datasets": ["name", "modality"],
      },
      noCache: true,
    });
  }

  async function deleteDataset(): Promise<void> {
    await datasetsBackendDataSource.delete(datasetId);
    goto(resolve(`/projects/${projectId}/datasets`));
    $refetches.datasets.list = new Date();
    openConfirmDeleteDatasetModal = false;
  }

  async function exportDataset(): Promise<void> {
    await datasetsBackendDataSource.export(datasetId);
    openExportDatasetModal = false;
    // TODO: open modal when finish or download given exported file
  }
</script>

<DropdownMenus {menus} align="center">
  {#snippet trigger({ props })}
    <Button variant="ghost" size="icon" {...props}>
      <EllipsisVerticalIcon class="size-4"></EllipsisVerticalIcon>
    </Button>
  {/snippet}
</DropdownMenus>

<DatasetFormModal title="Dataset" action="update" {datasetRecord} bind:open={openEditDatasetFormModal} />

<ConfirmModal
  title="Delete Dataset"
  description="Are you sure you want to delete this dataset?"
  onConfirm={deleteDataset}
  bind:open={openConfirmDeleteDatasetModal}
></ConfirmModal>

<!-- TODO: should we allow editing the exporting file/dataset name ? -->
<ExportModal
  title="Export Dataset"
  description="Confirm to export the dataset: "
  {datasetRecord}
  onConfirm={exportDataset}
  bind:open={openExportDatasetModal} />