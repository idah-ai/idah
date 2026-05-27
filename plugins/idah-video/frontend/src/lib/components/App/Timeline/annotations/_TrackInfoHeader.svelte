<script lang="ts">
  import { EyeIcon, EyeOffIcon, LockIcon, LockOpenIcon, Trash2Icon } from "@lucide/svelte";

  import Button from "$lib/components/ui/Button/Button.svelte";
  import ToolTooltip from "$lib/components/ui/Tooltips/ToolTooltip.svelte";

  import { annotation } from "$lib/state/annotation.svelte";
  import { getDriver } from "$lib/state/driver.svelte";
  import { selection } from "$lib/state/selection.svelte";
  import { showConfirmDialog } from "$lib/components/App/ConfirmDialog/confirm-dialog";

  import type { Menus } from "$lib/components/App/ContextMenu/types";
  import type { IVideoAnnotationRecord } from "$lib/types";

  // Props
  interface Props {
    annotations: IVideoAnnotationRecord[];
  }
  let { annotations }: Props = $props();

  // Variables
  const isAllHidden = $derived(annotations.length > 0 && annotations.every((ann) => annotation.isHidden(ann)));
  const isAllLocked = $derived(annotations.length > 0 && annotations.every((ann) => annotation.isLocked(ann)));
  const menus = $derived<Menus>({
    actions: {
      items: {
        "visibility-all": {
          label: "Show/Hide All",
          icon: isAllHidden ? EyeOffIcon : EyeIcon,
          onClick: () => {
            getDriver().command.call("annotation.toggle_visibility_all");
          },
        },
        "editability-all": {
          label: "Lock/Unlock All",
          icon: isAllLocked ? LockIcon : LockOpenIcon,
          onClick: () => {
            getDriver().command.call("annotation.toggle_editability_all");
          },
        },
        "delete-all": {
          label: "Delete all annotations",
          icon: Trash2Icon,
          onClick: () => {
            showConfirmDialog({
              title: "Delete all annotations",
              description: "Are you sure you want to delete all annotations?",
              onConfirm: () => getDriver().command.call("annotation.delete_all"),
            });
          },
        },
      },
    },
  });
</script>

<div
  role="button"
  tabindex="-1"
  class="flex h-full cursor-pointer items-center px-2 select-none"
  onclick={selection.deselect}
  onkeypress={selection.deselect}
>
  <p class="text-xs font-medium">Annotations</p>

  <div class="ml-auto flex items-center">
    {#each Object.entries(menus.actions.items) as [key, { label, icon: Icon, onClick }] (key)}
      <ToolTooltip {label}>
        {#snippet trigger()}
          <Button
            variant="ghost"
            size="icon-sm"
            onclick={(e: MouseEvent) => {
              e.stopPropagation();
              onClick(e);
            }}
          >
            <Icon />
          </Button>
        {/snippet}
      </ToolTooltip>
    {/each}
  </div>
</div>
