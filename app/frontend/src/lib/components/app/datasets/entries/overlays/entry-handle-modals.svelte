<script lang="ts">
  import { getContext } from "svelte";

  import AssignEntryFormModal from "@/components/app/datasets/entries/overlays/assign-entry-form-modal.svelte";
  import UpdateEntryPriorityFormModal from "@/components/app/datasets/entries/overlays/update-entry-priority-form-modal.svelte";
  import UploadEntryFormModal from "@/components/app/datasets/entries/overlays/UploadEntryFormModal.svelte";
  import ConfirmModal from "@/components/app/overlays/modals/confirm-modal.svelte";

  import { deleteEntries, exportEntries, unAssignEntries } from "@/components/app/datasets/entries/util/entry-actions";
  import { DatasetRecord } from "@/data/model/dataset/dataset-record";
  import { pluralizeUnit } from "@/utils/unit";

  import type { EntriesListController } from "@/components/app/datasets/entries/overlays/entries-list.svelte";

  let {
    controller,
    datasetId,
  }: {
    controller: EntriesListController;
    datasetId: string;
  } = $props();

  // Modal visibility state - owned by this component
  let openNewEntry = $state(false);
  let openAssignEntry = $state(false);
  let openSetPriority = $state(false);
  let openConfirmUnassign = $state(false);
  let openConfirmDelete = $state(false);
  let openExport = $state(false);

  // Contexts
  const dataset: DatasetRecord = getContext("dataset");

  // Public API for opening modals
  export function openNewEntryModal(): void {
    openNewEntry = true;
  }

  export function openAssignEntryModal(): void {
    openAssignEntry = true;
  }

  export function openSetPriorityModal(): void {
    openSetPriority = true;
  }

  export function openConfirmUnassignModal(): void {
    openConfirmUnassign = true;
  }

  export function openConfirmDeleteModal(): void {
    openConfirmDelete = true;
  }

  export function openExportModal(): void {
    openExport = true;
  }

  // Functions
  async function handleUnassign(): Promise<void> {
    const updated = await unAssignEntries(controller.unAssignableEntryIds, (id) => controller.getEntryName(id));
    if (updated) {
      controller.patchEntries(updated);
      controller.clearSelection();
      openConfirmUnassign = false;
      // Refetch so server-authoritative state is reflected (e.g. wf_step changes)
      await controller.fetch();
    }
  }

  async function handleDelete(): Promise<void> {
    const ok = await deleteEntries(controller.selectedEntryIds, (id) => controller.getEntryName(id));
    if (ok) {
      controller.clearSelection();
      openConfirmDelete = false;
      await controller.fetch();
    }
  }

  async function handleExport(): Promise<void> {
    await exportEntries(datasetId, controller.selectedEntryIds);
    controller.clearSelection();
    openExport = false;
  }
</script>

<!-- ADD ENTRY -->
<UploadEntryFormModal title="Entry" action="create" modality={dataset.modality} bind:open={openNewEntry} />

<!-- ASSIGN ANNOTATOR -->
<AssignEntryFormModal
  action="update"
  entryIds={controller.assignableEntryIds}
  onAssigned={async () => {
    controller.clearSelection();
    await controller.fetch();
  }}
  entryRecord={controller.assignableEntryIds.length === 1
    ? controller.entryMap.get(controller.assignableEntryIds[0])
    : undefined}
  bind:open={openAssignEntry}
/>

<!-- SET PRIORITY -->
<UpdateEntryPriorityFormModal action="update" entryIds={controller.selectedEntryIds} bind:open={openSetPriority} />

<!-- CONFIRM UNASSIGN -->
<ConfirmModal
  title="Unassign entry"
  description={`Are you sure you want to unassign ${controller.unAssignableEntryIds.length} ${pluralizeUnit(controller.unAssignableEntryIds.length, "entry", "entries")}?`}
  onConfirm={handleUnassign}
  bind:open={openConfirmUnassign}
/>

<!-- CONFIRM DELETE -->
<ConfirmModal
  title="Delete entry"
  description={`Are you sure you want to delete ${controller.selectedRowsCount} ${pluralizeUnit(controller.selectedRowsCount, "entry", "entries")}? This action cannot be undone.`}
  onConfirm={handleDelete}
  bind:open={openConfirmDelete}
/>

<!-- CONFIRM EXPORT -->
<ConfirmModal
  title="Export {controller.selectedRowsCount} {pluralizeUnit(controller.selectedRowsCount, 'entry', 'entries')}"
  description="Are you sure you want to export {controller.selectedRowsCount} {pluralizeUnit(
    controller.selectedRowsCount,
    'entry',
    'entries',
  )}?"
  onConfirm={handleExport}
  bind:open={openExport}
/>
