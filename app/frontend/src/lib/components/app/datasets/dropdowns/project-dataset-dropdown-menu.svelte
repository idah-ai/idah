<script lang="ts">
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";

  import { CopyIcon, DownloadIcon, SquarePenIcon, Trash2Icon } from "@lucide/svelte";
  import { onMount } from "svelte";

  import DatasetFormModal from "@/components/app/datasets/overlays/dataset-form-modal.svelte";
  import DatasetDuplicateModal from "@/components/app/datasets/overlays/dataset-duplicate-modal.svelte";
  import DropdownMenus from "@/components/app/dropdown-menus/dropdown-menus.svelte";
  import ConfirmModal from "@/components/app/overlays/modals/confirm-modal.svelte";
  import ExportFormModal from "@/components/app/projects/exports/overlays/export-form-modal.svelte";

  import { showToast } from "@/components/ui/toast/index.svelte";
  import { DatasetRecord, datasetsBackendDataSource } from "@/data/model/dataset/dataset-record";
  import { ProjectRecord } from "@/data/model/dataset/projects/project-record";
  import { authStatus } from "@/security/AuthContext";
  import { showActionFailedToast } from "@/utils/error/error.toasts";
  import { refetches } from "@/utils/refetch";

  import type { DropdownMenuContentAlignment, IDropdownMenus } from "@/components/app/dropdown-menus/types";
  import type { ProjectMemberScope } from "@/security/types";
  import { entriesBackendDataSource, EntryRecord } from "@/data/model/dataset/entries/record";

  // Props
  interface Props {
    datasetId: string;
    datasetName: string;
    projectId: string;
    align?: DropdownMenuContentAlignment;
  }

  let { datasetId, datasetName, projectId, align = "end" }: Props = $props();

  // Variables
  let canCreateDataset = $state(false);
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
          label: "Duplicate",
          icon: CopyIcon,
          hidden: !canCreateDataset,
          action: async () => {
            const datasetEntriesRes = await fetchDatasetEntries();
            datasetEntryRecords = datasetEntriesRes.data;
            openDuplicateDatasetFormModal = true;
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
  let datasetEntryRecords: EntryRecord[] = $state([]);
  let openEditDatasetFormModal: boolean = $state(false);
  let openDuplicateDatasetFormModal: boolean = $state(false);
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

    canCreateDataset =
      (await $authStatus.authContext?.can("create", "dataset:datasets", ["as_org_owner", as_project_owner])) || false;
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
      showActionFailedToast(error);
    }
  }

  async function fetchDatasetEntries() {
    return await entriesBackendDataSource.list({
      filters: { dataset_id: datasetId },
      fields: {
        [EntryRecord.type]: ["id", "resource", "status", "priority", "created_at", "updated_at", "wf_step"],
      },
    });
  }
</script>

{#if canCreateDataset}
  <DatasetDuplicateModal
    title="Duplicate Dataset"
    action="create"
    {projectId}
    {datasetId}
    {datasetName}
    {datasetEntryRecords}
    bind:open={openDuplicateDatasetFormModal}
  />
{/if}

{#if canUpdateDataset || canDeleteDataset}
  <DropdownMenus {menus} align="end" />
{/if}

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
