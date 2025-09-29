<script lang="ts">
  import { goto } from "$app/navigation";

  import Button from "@/components/ui/button/button.svelte";
  import ConfirmModal from "@/components/app/overlays/modals/confirm-modal.svelte";
  import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuTrigger,
  } from "@/components/ui/dropdown-menu";
  import DatasetFormModal from "@/components/app/datasets/overlays/dataset-form-modal.svelte";

  import { EllipsisVerticalIcon, SquarePenIcon, Trash2Icon } from "@lucide/svelte";
  import { ProjectRecord, projectsBackendDataSource } from "@/data/model/dataset/projects/project-record";
  import { DatasetRecord, datasetsBackendDataSource } from "@/data/model/dataset/dataset-record";

  import { refetches } from "@/utils/refetch";

  import type { DropdownMenuItemBaseProps } from "@/components/app/dropdown-menus/dropdown-menu.types";

  // Props
  interface Props {
    datasetId: string;
    projectId: string;
  }
  let { datasetId, projectId }: Props = $props();

  // Variables
  const menus: DropdownMenuItemBaseProps[] = [
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
  ];

  let datasetRecord: DatasetRecord | undefined = $state(undefined);
  let openEditDatasetFormModal: boolean = $state(false);
  let openConfirmDeleteDatasetModal: boolean = $state(false);

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
    goto("/projects/ " + projectId + "/datasets");
    $refetches.datasets.list++;
    openConfirmDeleteDatasetModal = false;
  }
</script>

<DropdownMenu>
  <DropdownMenuTrigger>
    {#snippet child({ props })}
      <Button variant="ghost" size="icon" {...props}>
        <EllipsisVerticalIcon class="size-4" />
      </Button>
    {/snippet}
  </DropdownMenuTrigger>

  <DropdownMenuContent align="end">
    <DropdownMenuGroup>
      {#each menus as { label, icon: Icon, action }}
        <DropdownMenuItem onclick={action}>
          <Icon class="size-4" />
          {label}
        </DropdownMenuItem>
      {/each}
    </DropdownMenuGroup>
  </DropdownMenuContent>
</DropdownMenu>

<DatasetFormModal title="Dataset" action="update" {datasetRecord} bind:open={openEditDatasetFormModal} />

<ConfirmModal
  title="Delete Dataset"
  description="Are you sure you want to delete this dataset?"
  onConfirm={deleteDataset}
  bind:open={openConfirmDeleteDatasetModal}
></ConfirmModal>
