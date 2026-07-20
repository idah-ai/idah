<script lang="ts">
  import { EyeIcon, EyeOffIcon, LockIcon, LockOpenIcon, Trash2Icon } from "@lucide/svelte";

  import KbdTooltipButton from "$lib/components/ui/Tooltips/KbdTooltipButton.svelte";

  import { annotation } from "$lib/state/annotation.svelte";
  import { getDriver } from "$lib/state/driver.svelte";
  import { selection } from "$lib/state/selection.svelte";
  import { viewport } from "$lib/state/viewport.svelte";
  import { showConfirmDialog } from "$lib/components/App/ConfirmDialog/confirm-dialog";
  import { isEditable } from "$lib/state/editor.svelte";

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
  const isSomeLocked = $derived(annotations.some((ann) => annotation.isLocked(ann)));
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
          disabled: !isEditable() || isSomeLocked || viewport.isReviewWorkspace,
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
    {#each Object.entries(menus.actions.items) as [key, { label, icon, disabled, onClick }] (key)}
      <KbdTooltipButton
        {label}
        {icon}
        variant="ghost"
        size="icon-sm"
        {disabled}
        onclick={(e: MouseEvent) => {
          e.stopPropagation();
          onClick(e);
        }}
      />
    {/each}
  </div>
</div>
