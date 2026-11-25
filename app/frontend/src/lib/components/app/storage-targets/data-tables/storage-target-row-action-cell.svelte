<script lang="ts">
  import { ArchiveIcon, CirclePowerIcon, PlugZapIcon, SquarePenIcon } from "@lucide/svelte";

  import DropdownMenus from "@/components/app/dropdown-menus/dropdown-menus.svelte";
  import StorageTargetFormModal from "@/components/app/storage-targets/overlays/storage-target-form-modal.svelte";

  import { showConfirmModal } from "@/components/app/overlays/modals/confirm-modal.service.svelte";
  import { confirmModalResult } from "@/components/app/overlays/modals/confirm-modal.types";
  import { showToast } from "@/components/ui/toast/index.svelte";
  import { ProjectRecord, projectsBackendDataSource } from "@/data/model/dataset/projects/project-record";
  import { StorageTargetRecord, storageTargetsBackendDataSource } from "@/data/model/setting/storage_target/record";
  import { connectionErrorMessage, storageTargetSaveErrorMessage } from "@/data/model/setting/storage_target/utils";
  import { refetches } from "@/utils/refetch";

  import type { DataTableCellBaseProps } from "@/components/app/datasource-table/types";
  import type { IDropdownMenus } from "@/components/app/dropdown-menus/types";

  // Props
  let { record: target }: DataTableCellBaseProps<StorageTargetRecord> = $props();

  // Variables
  let editedTarget: StorageTargetRecord | undefined = $state(undefined);
  let openEditModal: boolean = $state(false);

  let menus: IDropdownMenus = $derived({
    actions: {
      items: [
        {
          label: "Edit",
          icon: SquarePenIcon,
          action: openEdit,
        },
        {
          label: "Test connection",
          icon: PlugZapIcon,
          action: testConnection,
        },
        {
          label: target.enabled ? "Disable" : "Enable",
          icon: CirclePowerIcon,
          action: target.enabled ? confirmDisable : enable,
        },
        {
          label: "Archive",
          icon: ArchiveIcon,
          hidden: target.enabled,
          action: confirmArchive,
        },
      ],
    },
  });

  // Functions
  async function openEdit(): Promise<void> {
    const res = await storageTargetsBackendDataSource.get(target.id, { noCache: true });
    editedTarget = res.data;
    openEditModal = true;
  }

  async function testConnection(): Promise<void> {
    try {
      const result = await storageTargetsBackendDataSource.testSaved(target.id);

      if (result.ok) {
        showToast.success({
          title: "Connection works",
          description: `A test file was written, read back and deleted in "${target.name}".`,
        });
      } else {
        showToast.error({ title: "Connection failed", description: connectionErrorMessage(result.error) });
      }
    } catch (error) {
      showToast.error({ title: "Connection test failed", description: storageTargetSaveErrorMessage(error) });
    }
  }

  async function setEnabled(enabled: boolean): Promise<void> {
    await storageTargetsBackendDataSource.update(target.id, { attributes: { enabled } }, { showErrorToast: false });

    $refetches.storageTargets.list = new Date();
    showToast.success({
      title: enabled ? "Storage target enabled" : "Storage target disabled",
      description: enabled
        ? `"${target.name}" can be chosen for new projects.`
        : `"${target.name}" can't be chosen for new projects anymore. Projects already using it keep working.`,
    });
  }

  async function enable(): Promise<void> {
    try {
      await setEnabled(true);
    } catch (error) {
      showToast.error({ title: "Couldn't enable the target", description: storageTargetSaveErrorMessage(error) });
    }
  }

  async function confirmDisable(): Promise<void> {
    await showConfirmModal({
      title: "Disable storage target",
      confirmLabel: "Disable",
      description: `"${target.name}" will no longer be offered for new projects. Projects already using it keep storing and reading their files there.`,
      onConfirm: async () => {
        try {
          await setEnabled(false);
        } catch (error) {
          showToast.error({ title: "Couldn't disable the target", description: storageTargetSaveErrorMessage(error) });
          return confirmModalResult.KeepOpen;
        }
      },
    });
  }

  async function projectsUsingTarget(): Promise<string[]> {
    const res = await projectsBackendDataSource.list({
      fields: { [ProjectRecord.type]: ["name"] },
      filters: { storage_target_id: target.id },
      noCache: true,
    });

    return res.data.map((project) => project.name);
  }

  async function confirmArchive(): Promise<void> {
    const projects = await projectsUsingTarget().catch(() => [] as string[]);
    const usage = projects.length
      ? `${projects.length} project(s) still store their files there (${projects.slice(0, 5).join(", ")}${projects.length > 5 ? ", …" : ""}). Their files stay readable after archiving.`
      : "No project uses it.";

    await showConfirmModal({
      title: "Archive storage target",
      confirmLabel: "Archive",
      description: `"${target.name}" will be hidden from this list. ${usage}`,
      onConfirm: async () => {
        try {
          await storageTargetsBackendDataSource.delete(target.id, { showErrorToast: false });

          $refetches.storageTargets.list = new Date();
          showToast.success({ title: "Storage target archived", description: `"${target.name}" has been archived.` });
        } catch (error) {
          showToast.error({ title: "Couldn't archive the target", description: storageTargetSaveErrorMessage(error) });
          return confirmModalResult.KeepOpen;
        }
      },
    });
  }
</script>

<DropdownMenus {menus} align="center" />

<StorageTargetFormModal title="Storage Target" action="update" targetRecord={editedTarget} bind:open={openEditModal} />
