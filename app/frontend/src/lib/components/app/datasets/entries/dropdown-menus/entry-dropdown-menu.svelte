<script lang="ts">
  import AssignEntryFormModal from "@/components/app/datasets/entries/overlays/assign-entry-form-modal.svelte";
  import Button from "@/components/ui/button/button.svelte";
  import ConfirmModal from "@/components/app/overlays/modals/confirm-modal.svelte";
  import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuTrigger,
  } from "@/components/ui/dropdown-menu";

  import { entriesBackendDataSource, EntryRecord } from "@/data/model/dataset/entries/record";
  import { refetches } from "@/utils/refetch";
  import { EllipsisVerticalIcon, Trash2Icon, UserRoundPlusIcon } from "@lucide/svelte";

  import type { DropdownMenuItemBaseProps } from "@/components/app/dropdown-menu/dropdown-menu.types";

  // Props
  interface Props {
    entry: EntryRecord;
  }
  let { entry }: Props = $props();

  // Records
  let entryRecord: EntryRecord | undefined = $state(undefined);

  // Variables
  const menus: DropdownMenuItemBaseProps[] = [
    {
      label: "Assign to",
      icon: UserRoundPlusIcon,
      action: async () => {
        const entryRes = await entriesBackendDataSource.get(entry.id, {
          noCache: true,
        });

        entryRecord = entryRes.data;
        openAssignEntryFormModal = true;
      },
    },
    {
      label: "Delete",
      icon: Trash2Icon,
      action: () => {
        openConfirmDeleteTaskModal = true;
      },
    },
  ];

  let openAssignEntryFormModal: boolean = $state(false);
  let openConfirmDeleteTaskModal: boolean = $state(false);

  // Functions
  async function deleteTask() {
    await entriesBackendDataSource.delete(entry.id);
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
      {#each menus as { label, icon: Icon, action }}
        <DropdownMenuItem onclick={action}>
          <Icon class="size-4" />
          {label}
        </DropdownMenuItem>
      {/each}
    </DropdownMenuGroup>
  </DropdownMenuContent>
</DropdownMenu>

<AssignEntryFormModal action="update" entryIds={[entry.id]} bind:open={openAssignEntryFormModal}></AssignEntryFormModal>

<ConfirmModal
  title="Delete task"
  description="Are you sure you want to delete this task?"
  onConfirm={deleteTask}
  bind:open={openConfirmDeleteTaskModal}
></ConfirmModal>
