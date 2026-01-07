<script lang="ts">
  import { page } from "$app/state";
  import { EllipsisVerticalIcon } from "@lucide/svelte";
  import { onMount } from "svelte";
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
  import { authStatus } from "@/security/AuthContext";
  import { showActionFailedToast } from "@/utils/error/error.toasts";
  import { refetches } from "@/utils/refetch";

  import type { ProjectMemberScope } from "@/security/types";

  // Props
  interface Props {
    entry: EntryRecord;
  }
  let { entry }: Props = $props();

  // Records
  let projectId = page.params.projectId as string;
  let entryRecord: EntryRecord | undefined = $state(undefined);

  // Variables
  const menus = getEntryDropdownMenuActions({
    onAssign: openAssignEntryModal,
    onSetPriority: () => {},
    onDelete: () => {
      openConfirmDeleteEntryModal = true;
    },
  }).filter((m) => m.label !== "Set Priority");

  let currentAccount = $authStatus.authContext;
  let canUpdateEntry = $state(false);
  let canDeleteEntry = $state(false);
  let openAssignEntryFormModal: boolean = $state(false);
  let openConfirmDeleteEntryModal: boolean = $state(false);

  // Lifecycle
  onMount(async () => {
    const as_project_owner: { as_user: ProjectMemberScope } = {
      as_user: {
        projectId,
        projectMemberRoles: ["project_owner"],
      },
    };

    canUpdateEntry =
      (await currentAccount?.can("update", "dataset:entries", ["as_org_owner", as_project_owner])) || false;
    canDeleteEntry =
      (await currentAccount?.can("delete", "dataset:entries", ["as_org_owner", as_project_owner])) || false;
  });

  // Functions
  async function openAssignEntryModal() {
    const entryRes = await entriesBackendDataSource.get(entry.id, {
      noCache: true,
    });

    entryRecord = entryRes.data;
    openAssignEntryFormModal = true;
  }

  async function deleteEntry() {
    try {
      await entriesBackendDataSource.delete(entry.id, { showErrorToast: false });

      openConfirmDeleteEntryModal = false;
      $refetches.entries.list = new Date();
      toast.success("Entry deleted", {
        description: `The entry "${entry.name}" has been deleted.`,
      });
    } catch (error) {
      showActionFailedToast(error);
    }
  }
</script>

{#if canUpdateEntry || canDeleteEntry}
  <DropdownMenu>
    <DropdownMenuTrigger>
      {#snippet child({ props })}
        <Button variant="ghost" size="icon" {...props}>
          <EllipsisVerticalIcon />
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
  <AssignEntryFormModal action="update" {entryRecord} entryIds={[entry.id]} bind:open={openAssignEntryFormModal} />

  <!-- MODAL::CONFIRM DELETE -->
  <ConfirmModal
    title="Delete entry"
    description="Are you sure you want to delete this entry?"
    onConfirm={deleteEntry}
    bind:open={openConfirmDeleteEntryModal}
  />
{/if}
