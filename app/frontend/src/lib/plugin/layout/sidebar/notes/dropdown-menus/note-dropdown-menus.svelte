<script lang="ts">
  import { EllipsisVerticalIcon, LinkIcon, PenSquareIcon, Trash2Icon } from "@lucide/svelte";
  import { SvelteURL } from "svelte/reactivity";

  import DropdownMenus from "@/components/app/dropdown-menus/dropdown-menus.svelte";
  import ConfirmModal from "@/components/app/overlays/modals/confirm-modal.svelte";
  import Button from "@/components/ui/button/button.svelte";

  import { showToast } from "@/components/ui/toast/index.svelte";

  import type { IDropdownMenus } from "@/components/app/dropdown-menus/types";

  // Props
  interface Props {
    noteFeedId: string;
    noteCommentId?: string;

    editable?: boolean;
    deletable?: boolean;

    onSwitchToEditMode?: () => void;
    onDelete?: () => Promise<void>;
  }
  let {
    noteFeedId,
    noteCommentId,

    editable = false,
    deletable = false,

    onSwitchToEditMode,
    onDelete,
  }: Props = $props();

  // Variables
  let openConfirmDeleteModal = $state(false);

  const menus: IDropdownMenus = $derived({
    actions: {
      items: [
        {
          label: "Copy link",
          icon: LinkIcon,
          action: () => {
            // Expect url like this #feed/[id](/comments/[id])?
            const url = new SvelteURL(window.location.href);

            url.hash = `#feed/${noteFeedId}`;
            if (noteCommentId) {
              url.hash += `/comments/${noteCommentId}`;
            }

            navigator.clipboard.writeText(url.toString());

            showToast.info({ title: "Link copied to clipboard." });
          },
        },
        {
          label: "Edit",
          icon: PenSquareIcon,
          disabled: !editable,
          action: async () => {
            onSwitchToEditMode?.();
          },
        },
        {
          label: noteCommentId ? "Delete comment" : "Delete feed",
          icon: Trash2Icon,
          destructive: true,
          disabled: !deletable,
          action: () => {
            openConfirmDeleteModal = true;
          },
        },
      ],
    },
  });

  // Functions
  async function deleteNote() {
    await onDelete?.();
  }
</script>

<DropdownMenus {menus} align="end">
  {#snippet trigger({ props })}
    <Button {...props} variant="ghost" size="icon" class="group-hover:hover:bg-primary/20 size-6 rounded-full">
      <EllipsisVerticalIcon class="size-3" />
    </Button>
  {/snippet}
</DropdownMenus>

<ConfirmModal
  title={noteCommentId ? "Delete Note Comment" : "Delete Note Feed"}
  description="Are you sure you want to delete this note? This action cannot be undone."
  onConfirm={deleteNote}
  bind:open={openConfirmDeleteModal}
></ConfirmModal>
