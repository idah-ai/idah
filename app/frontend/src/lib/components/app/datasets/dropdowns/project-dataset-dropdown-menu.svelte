<script lang="ts">
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { DownloadIcon, SquarePenIcon, Trash2Icon } from "@lucide/svelte";
  import { onMount } from "svelte";

  import DatasetFormModal from "@/components/app/datasets/overlays/dataset-form-modal.svelte";
  import DropdownMenus from "@/components/app/dropdown-menus/dropdown-menus.svelte";
  import ConfirmModal from "@/components/app/overlays/modals/confirm-modal.svelte";
  import ExportFormModal from "@/components/app/projects/exports/overlays/export-form-modal.svelte";

  import { showToast } from "@/components/ui/toast/index.svelte";
  import { DatasetRecord, datasetsBackendDataSource } from "@/data/model/dataset/dataset-record";
  import { ProjectRecord } from "@/data/model/dataset/projects/project-record";
  import { authStatus } from "@/security/AuthContext";
  import { refetches } from "@/utils/refetch";

  import type { DropdownMenuContentAlignment, IDropdownMenus } from "@/components/app/dropdown-menus/types";
  import type { ProjectMemberScope } from "@/security/types";

  // Props
  interface Props {
    datasetId: string;
    projectId: string;
    align?: DropdownMenuContentAlignment;
  }
  let { datasetId, projectId, align = "end" }: Props = $props();

  // Variables
  let canUpdateDataset = $state(false);
  let canDeleteDataset = $state(false);
  let canExportDataset = $state(false);
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
          label: "Export",
          icon: DownloadIcon,
          hidden: !canExportDataset,
          action: async () => {
            const datasetRes = await fetchDataset();

            datasetRecord = datasetRes.data;
            openExportFormModal = true;
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
  let openExportFormModal: boolean = $state(false);

  // Lifecycle
  onMount(async () => {
    await Promise.all([checkRights()]);

    const datasetRes = await fetchDataset();
    datasetRecord = datasetRes.data;
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
    canExportDataset =
      (await $authStatus.authContext?.can("create", "sync:exports", ["as_org_owner", as_project_owner])) || false;
  }

  async function fetchDataset() {
    return await datasetsBackendDataSource.get(datasetId, {
      fields: {
        [ProjectRecord.type]: ["id"],
        [DatasetRecord.type]: ["name", "modality"],
      },
      included: ["project"],
      noCache: true,
    });
  }

  async function deleteDataset(): Promise<void> {
    try {
      await datasetsBackendDataSource.delete(datasetId, { showErrorToast: false });
      openConfirmDeleteDatasetModal = false;
      $refetches.datasets.list = new Date();
      goto(resolve(`/projects/${projectId}/datasets`));
      showToast.success({
        title: "Dataset deleted",
        description: `The dataset "${datasetRecord?.name}" has been deleted.`,
      });
    } catch (error) {
      showToast.error({
        title: "Unable to delete dataset",
        description: error?.errors[0]?.detail || "The action could not be completed, please try again later.",
      });
    }
  }
</script>

{#if canUpdateDataset || canDeleteDataset || canExportDataset}
  <DropdownMenus {menus} {align} />

  <DatasetFormModal title="Dataset" action="update" {datasetRecord} bind:open={openEditDatasetFormModal} />

  <ExportFormModal
    title="Export Dataset(s)"
    action="create"
    datasetRecords={datasetRecord ? [datasetRecord] : []}
    bind:open={openExportFormModal}
  />

  <ConfirmModal
    title="Delete Dataset"
    description="Are you sure you want to delete this dataset?"
    onConfirm={deleteDataset}
    bind:open={openConfirmDeleteDatasetModal}
  />
{/if}
