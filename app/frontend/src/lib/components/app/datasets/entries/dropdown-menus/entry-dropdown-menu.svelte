<script lang="ts">
  import { EllipsisVerticalIcon } from "@lucide/svelte";
  import { toast } from "svelte-sonner";

  import AssignEntryFormModal from "@/components/app/datasets/entries/overlays/assign-entry-form-modal.svelte";
  import ConfirmModal from "@/components/app/overlays/modals/confirm-modal.svelte";
  import Button from "@/components/ui/button/button.svelte";
  import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuTrigger,
  } from "@/components/ui/dropdown-menu";

  import { getEntryDropdownMenuActions } from "@/components/app/datasets/entries/dropdown-menus/entry-dropdown-menu";
  import { entriesBackendDataSource, EntryRecord } from "@/data/model/dataset/entries/record";
  import { refetches } from "@/utils/refetch";

  // Props
  interface Props {
    entry: EntryRecord;
  }
  let { entry }: Props = $props();

  // Records
  let entryRecord: EntryRecord | undefined = $state(undefined);

  // Variables
  const menus = getEntryDropdownMenuActions({
    onAssign: openAssignEntryModal,
    onSetPriority: () => {},
    onDelete: () => {
      openConfirmDeleteTaskModal = true;
    },
  }).filter((m) => m.label !== "Set Priority");

  let openAssignEntryFormModal: boolean = $state(false);
  let openConfirmDeleteTaskModal: boolean = $state(false);

  // Functions
  async function openAssignEntryModal() {
    const entryRes = await entriesBackendDataSource.get(entry.id, {
      noCache: true,
    });

    entryRecord = entryRes.data;
    openAssignEntryFormModal = true;
  }

  async function deleteTask() {
    await entriesBackendDataSource.delete(entry.id);
    toast.success("Task successfully deleted!");
    $refetches.entries.list++;
    openConfirmDeleteTaskModal = false;
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
      {#each menus as { label, icon: Icon, action }, index (index)}
        <DropdownMenuItem onclick={action}>
          <Icon class="size-4" />
          {label}
        </DropdownMenuItem>
      {/each}
    </DropdownMenuGroup>
  </DropdownMenuContent>
</DropdownMenu>

<!-- MODAL::ASSIGN ANNOTATOR  -->
<AssignEntryFormModal action="update" {entryRecord} entryIds={[entry.id]} bind:open={openAssignEntryFormModal}
></AssignEntryFormModal>

<!-- MODAL::CONFIRM DELETE -->
<ConfirmModal
  title="Delete task"
  description="Are you sure you want to delete this task?"
  onConfirm={deleteTask}
  bind:open={openConfirmDeleteTaskModal}
></ConfirmModal>
