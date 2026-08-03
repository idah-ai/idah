<script lang="ts">
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { page } from "$app/state";
  import { ChevronsUpDownIcon, DownloadIcon, Trash2Icon } from "@lucide/svelte";
  import { onMount } from "svelte";

  import DropdownMenus from "@/components/app/dropdown-menus/dropdown-menus.svelte";
  import ExportFormModal from "@/components/app/projects/exports/overlays/export-form-modal.svelte";
  import Button from "@/components/ui/button/button.svelte";

  import { selectedDatasets } from "@/components/app/datasets/stores";
  import { showConfirmModal } from "@/components/app/overlays/modals/confirm-modal.service.svelte";
  import { ConfirmModalChoice, ConfirmModalResult } from "@/components/app/overlays/modals/confirm-modal.types";
  import { showToast } from "@/components/ui/toast/index.svelte";
  import { datasetsBackendDataSource } from "@/data/model/dataset/dataset-record";
  import { authStatus } from "@/security/AuthContext";
  import { showActionFailedToast } from "@/utils/error/error.toasts";
  import { refetches } from "@/utils/refetch";
  import { pluralizeUnit } from "@/utils/unit";

  import type { IDropdownMenus } from "@/components/app/dropdown-menus/types";
  import type { ProjectMemberScope } from "@/security/types";

  // Variables
  let projectId = page.params.projectId as string;
  let selectedDatasetsCount = $derived($selectedDatasets.length);
  let canExportDataset = $state(false);
  let canDeleteDataset = $state(false);
  let openExportFormModal = $state<boolean>(false);
  let menus: IDropdownMenus = $derived({
    actions: {
      items: [
        {
          label: "Export",
          icon: DownloadIcon,
          hidden: !canExportDataset,
          action: () => {
            openExportFormModal = true;
          },
        },
        {
          label: "Delete",
          icon: Trash2Icon,
          destructive: true,
          hidden: !canDeleteDataset,
          action: confirmDeleteDatasets,
        },
      ],
    },
  });

  // Lifecycle
  onMount(async () => {
    await Promise.all([checkRights()]);
  });

  // Functions
  async function checkRights() {
    const as_project_owner: { as_user: ProjectMemberScope } = {
      as_user: {
        projectId,
        projectMemberRoles: ["project_owner"],
      },
    };

    canDeleteDataset =
      (await $authStatus.authContext?.can("delete", "dataset:datasets", ["as_org_owner", as_project_owner])) || false;
    canExportDataset =
      (await $authStatus.authContext?.can("create", "sync:exports", ["as_org_owner", as_project_owner])) || false;
  }

  async function confirmDeleteDatasets(): Promise<void> {
    // Captured before the mutation: clearing $selectedDatasets resets selectedDatasetsCount to 0.
    const count = selectedDatasetsCount;

    const choice = await showConfirmModal({
      title: "Delete Datasets",
      description: `Are you sure you want to delete ${count} ${pluralizeUnit(count, "dataset")}? This action cannot be undone.`,
      confirmLabel: "Yes, Delete",
      onConfirm: async () => {
        try {
          await Promise.all(
            $selectedDatasets.map(async (dataset) => {
              await datasetsBackendDataSource.delete(dataset.id);
            }),
          );

          $refetches.datasets.list = new Date();
          $selectedDatasets = [];
          showToast.success({
            title: "Datasets deleted",
            description: `The ${count} ${pluralizeUnit(count, "dataset")} have been deleted.`,
          });
        } catch (error) {
          showActionFailedToast(error);
          return ConfirmModalResult.KeepOpen;
        }
      },
    });
    if (choice === ConfirmModalChoice.Cancel) return;

    // Navigating inside `onConfirm` would run while the modal is still open.
    goto(resolve(`/projects/${projectId}/datasets`));
  }
</script>

{#if canExportDataset || canDeleteDataset}
  <DropdownMenus {menus} align="end">
    {#snippet trigger({ props })}
      {@const isOpen = props["data-state"] === "open"}
      <Button variant={isOpen ? "secondary" : "outline"} {...props}>
        {$selectedDatasets.length} selected
        <ChevronsUpDownIcon />
      </Button>
    {/snippet}
  </DropdownMenus>

  <ExportFormModal
    title="Export Dataset(s)"
    action="create"
    datasetRecords={$selectedDatasets}
    bind:open={openExportFormModal}
  />
{/if}
