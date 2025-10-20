<script lang="ts">
  import { EllipsisVerticalIcon, LinkIcon, PenSquareIcon, Trash2Icon } from "@lucide/svelte";

  import DropdownMenus from "@/components/app/dropdown-menus/dropdown-menus.svelte";
  import Button from "@/components/ui/button/button.svelte";

  import type { IDropdownMenus } from "@/components/app/dropdown-menus/types";

  // Props
  interface Props {
    id: string;
    resource: "noteFeed" | "noteComment";
  }
  let { id }: Props = $props();

  // Variables
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
          label: "Edit note",
          icon: PenSquareIcon,
          action: () => {},
        },
        {
          label: "Delete note",
          icon: Trash2Icon,
          action: () => {},
        },
      ],
    },
  };
</script>

<DropdownMenus {menus} align="end">
  {#snippet trigger({ props })}
    <Button {...props} variant="ghost" size="icon" class="group-hover:hover:bg-muted size-6 rounded-full">
      <EllipsisVerticalIcon class="size-3" />
    </Button>
  {/snippet}
</DropdownMenus>
