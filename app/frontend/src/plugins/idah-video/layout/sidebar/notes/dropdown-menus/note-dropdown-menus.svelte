<script lang="ts">
  import { getContext } from "svelte";

  import { EllipsisVerticalIcon, LinkIcon, PenSquareIcon, Trash2Icon } from "@lucide/svelte";

  import DropdownMenus from "@/components/app/dropdown-menus/dropdown-menus.svelte";
  import ConfirmModal from "@/components/app/overlays/modals/confirm-modal.svelte";
  import Button from "@/components/ui/button/button.svelte";

  import { noteSidebarStore } from "../note-sidebar-stores";

  import type { IDropdownMenus } from "@/components/app/dropdown-menus/types";
  import type { IActivityContext } from "@/plugin/interface/Activity";

  // Props
  interface Props {
    id: string;
    resource: "noteFeed" | "noteComment";
  }
  let { id, resource }: Props = $props();

  // Contexts
  const context: IActivityContext = getContext("context");

  // Variables
  let openConfirmDeleteModal = $state(false);

  const menus: IDropdownMenus = {
    actions: {
      items: [
        {
          label: "Copy link",
          icon: LinkIcon,
          action: () => {
            const url = new URL(window.location.href);
            url.hash = `note-${id}`;
            navigator.clipboard.writeText(url.toString());
          },
        },
        {
          label: "Edit",
          icon: PenSquareIcon,
          action: async () => {
            if (resource === "noteFeed") {
              // Edit note feed logic
            }

            if (resource === "noteComment") {
              // Edit note comment logic
            }
          },
        },
        {
          label: "Delete",
          icon: Trash2Icon,
          action: () => {
            openConfirmDeleteModal = true;
          },
        },
      ],
    },
  };

  // Functions
  async function deleteNote() {
    switch (resource) {
      case "noteFeed": {
        await context.notes.feeds.delete(id);
        break;
      }

      case "noteComment": {
        await context.notes.comments.delete(id);
        break;
      }
    }
    openConfirmDeleteModal = false;
    $noteSidebarStore.lastUpdated = new Date();
  }
</script>

<DropdownMenus {menus} align="end">
  {#snippet trigger({ props })}
    <Button {...props} variant="ghost" size="icon" class="group-hover:hover:bg-muted size-6 rounded-full">
      <EllipsisVerticalIcon class="size-3" />
    </Button>
  {/snippet}
</DropdownMenus>

<ConfirmModal
  title="Delete Note"
  description="Are you sure you want to delete this note? This action cannot be undone."
  onConfirm={deleteNote}
  bind:open={openConfirmDeleteModal}
></ConfirmModal>
