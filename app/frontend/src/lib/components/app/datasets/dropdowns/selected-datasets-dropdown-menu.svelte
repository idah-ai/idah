<script lang="ts">
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { page } from "$app/state";
  import { DownloadIcon, Trash2Icon } from "@lucide/svelte";
  import { onMount } from "svelte";

  import DropdownMenus from "@/components/app/dropdown-menus/dropdown-menus.svelte";
  import ConfirmModal from "@/components/app/overlays/modals/confirm-modal.svelte";
  import Button from "@/components/ui/button/button.svelte";

  import { selectedDatasets } from "@/components/app/datasets/stores";
  import { showToast } from "@/components/ui/toast/index.svelte";
  import { datasetsBackendDataSource } from "@/data/model/dataset/dataset-record";
  import { authStatus } from "@/security/AuthContext";
  import { showActionFailedToast } from "@/utils/error/error.toasts";
  import { refetches } from "@/utils/refetch";

  import type { IDropdownMenus } from "@/components/app/dropdown-menus/types";

  // Variables
  let projectId = page.params.projectId;
  let selectedDatasetsCount = $derived($selectedDatasets.length);
  let deleting = $state(false);
  let canExportDataset = $state(false);
  let canDeleteDataset = $state(false);
  let menus: IDropdownMenus = $derived({
    actions: {
      items: [
        {
          label: "Export",
          icon: DownloadIcon,
          hidden: !canExportDataset,
          action: async () => {},
        },
        {
          label: "Delete",
          icon: Trash2Icon,
          hidden: !canDeleteDataset,
          action: async () => {
            openConfirmDeleteDatasetsModal = true;
          },
        },
      ],
    },
  });
  let openConfirmDeleteDatasetsModal: boolean = $state(false);

  // Lifecycle
  onMount(async () => {
    await Promise.all([checkRights()]);
  });

  // Functions
  async function checkRights() {
    canDeleteDataset = (await $authStatus.authContext?.can("delete", "dataset:datasets", ["as_org_owner"])) || false;
    canExportDataset = (await $authStatus.authContext?.can("create", "sync:exports", ["as_org_owner"])) || false;
  }

  async function deleteDatasets() {
    deleting = true;

    try {
      await Promise.all(
        $selectedDatasets.map(async (dataset) => {
          await datasetsBackendDataSource.delete(dataset.id);
        }),
      );

      $refetches.datasets.list = new Date();
      openConfirmDeleteDatasetsModal = false;
      $selectedDatasets = [];
      goto(resolve(`/projects/${projectId}/datasets`));
      showToast.success({
        title: "Datasets deleted",
        description: `The ${selectedDatasetsCount} dataset${selectedDatasetsCount > 1 ? "s" : ""} have been deleted.`,
      });
    } catch (error) {
      showActionFailedToast(error);
      deleting = false;
    }
  }
</script>

{#if canExportDataset || canDeleteDataset}
  <DropdownMenus {menus} align="end" />

  <ConfirmModal
    title="Delete Datasets"
    description="Are you sure you want to delete {selectedDatasetsCount} dataset{selectedDatasetsCount > 1 ? 's' : ''}?"
    onConfirm={deleteDatasets}
    bind:open={openConfirmDeleteDatasetsModal}
  >
    {#snippet confirm()}
      <Button variant="destructive" loading={deleting} onclick={deleteDatasets}>Yes, Delete</Button>
    {/snippet}
  </ConfirmModal>
{/if}
