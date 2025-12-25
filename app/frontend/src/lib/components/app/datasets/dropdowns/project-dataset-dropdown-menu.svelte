<script lang="ts">
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { SquarePenIcon, Trash2Icon } from "@lucide/svelte";
  import { onMount } from "svelte";
  import { toast } from "svelte-sonner";

  import DatasetFormModal from "@/components/app/datasets/overlays/dataset-form-modal.svelte";
  import DropdownMenus from "@/components/app/dropdown-menus/dropdown-menus.svelte";
  import ConfirmModal from "@/components/app/overlays/modals/confirm-modal.svelte";

  import { DatasetRecord, datasetsBackendDataSource } from "@/data/model/dataset/dataset-record";
  import { authStatus } from "@/security/AuthContext";
  import { refetches } from "@/utils/refetch";

  import type { IDropdownMenus } from "@/components/app/dropdown-menus/types";
  import type { ProjectMemberScope } from "@/security/types";

  // Props
  interface Props {
    datasetId: string;
    projectId: string;
  }
  let { datasetId, projectId }: Props = $props();

  // Variables
  let canUpdateDataset = $state(false);
  let canDeleteDataset = $state(false);
  let menus: IDropdownMenus = $derived({
    actions: {
      items: [
        {
          label: "Edit",
          icon: SquarePenIcon,
          hidden: !canUpdateDataset,
          action: async () => {
            const datasetRes = await fetchDataset();

            datasetRecord = datasetRes.data;
            openEditDatasetFormModal = true;
          },
        },
        {
          label: "Delete",
          icon: Trash2Icon,
          hidden: !canDeleteDataset,
          action: () => {
            openConfirmDeleteDatasetModal = true;
          },
        },
      ],
    },
  });

  let datasetRecord: DatasetRecord | undefined = $state(undefined);
  let openEditDatasetFormModal: boolean = $state(false);
  let openConfirmDeleteDatasetModal: boolean = $state(false);

  // Lifecycle
  onMount(async () => {
    await Promise.all([checkRights(), fetchDataset()]);
  });

  // Functions
  async function checkRights() {
    const as_project_owner: { as_user: ProjectMemberScope } = {
      as_user: {
        projectId,
        projectMemberRoles: ["project_owner"],
      },
    };

    canUpdateDataset =
      (await $authStatus.authContext?.can("update", "dataset:datasets", ["as_org_owner", as_project_owner])) || false;
    canDeleteDataset =
      (await $authStatus.authContext?.can("delete", "dataset:datasets", ["as_org_owner", as_project_owner])) || false;
  }

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
    toast.success("Dataset deleted", {
      description: `The dataset ${datasetRecord?.name} has been deleted.`,
    });
    goto(resolve(`/projects/${projectId}/datasets`));
    $refetches.datasets.list = new Date();
    openConfirmDeleteDatasetModal = false;
  }
</script>

{#if canUpdateDataset || canDeleteDataset}
  <DropdownMenus {menus} align="end" />

  <DatasetFormModal title="Dataset" action="update" {datasetRecord} bind:open={openEditDatasetFormModal} />

  <ConfirmModal
    title="Delete Dataset"
    description="Are you sure you want to delete this dataset?"
    onConfirm={deleteDataset}
    bind:open={openConfirmDeleteDatasetModal}
  />
{/if}
