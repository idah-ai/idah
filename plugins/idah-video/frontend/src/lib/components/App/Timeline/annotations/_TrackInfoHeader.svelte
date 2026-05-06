<script lang="ts">
  import { EyeIcon, EyeOffIcon, LockIcon, LockOpenIcon, Trash2Icon } from "@lucide/svelte";
  import { getContext } from "svelte";

  import ConfirmModal from "$lib/components/ui/Overlays/modals/ConfirmModal.svelte";
  import ToolTooltip from "$lib/components/ui/Tooltips/ToolTooltip.svelte";
  import Button from "$lib/components/ui/Button/Button.svelte";

  import { deselectAnnotationGroup } from "$lib/plugin/video-annotation-activity/store/store";

  import type { IActivityContext } from "$idah/context/activity-context";
  import type { Menus } from "$lib/plugin/video-annotation-activity/context-menu/context-menu.types";
  import type { VideoAnnotationObject } from "$lib/plugin/video-annotation-activity/context/video-annotation-context";

  // Props
  interface Props {
    annotations: VideoAnnotationObject[];
  }
  let { annotations }: Props = $props();

  // Contexts
  const context: IActivityContext = getContext("context");

  // Vairables
  let openConfirmDeleteAllDialog = $state(false);

  const isAllHidden = $derived(annotations.every((a) => a.hidden));
  const isAllLocked = $derived(annotations.every((a) => a.locked));
  const menus = $derived<Menus>({
    actions: {
      items: {
        "visibility-all": {
          label: isAllHidden ? "Show all" : "Hide all",
          icon: isAllHidden ? EyeIcon : EyeOffIcon,
          onClick: () => {
            context.commands.run("annotation.toggleAllVisibility");
          },
        },
        "editability-all": {
          label: isAllLocked ? "Unlock all" : "Lock all",
          icon: isAllLocked ? LockOpenIcon : LockIcon,
          onClick: () => {
            context.commands.run("annotation.toggleAllEditability");
          },
        },
        "delete-all": {
          label: "Delete all annotations",
          icon: Trash2Icon,
          onClick: () => {
            openConfirmDeleteAllDialog = true;
          },
        },
      },
    },
  });

  // Functions
  function deleteAllAnnotations() {
    context.commands.run("annotation.deleteAll");
    openConfirmDeleteAllDialog = false;
  }
</script>

<div
  role="button"
  tabindex="-1"
  class="flex h-full cursor-pointer items-center px-2 select-none"
  onclick={deselectAnnotationGroup}
  onkeypress={deselectAnnotationGroup}
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
              onClick();
            }}
          >
            <Icon />
          </Button>
        {/snippet}
      </ToolTooltip>
    {/each}
  </div>
</div>

<ConfirmModal
  title="Delete all annotations"
  description="Are you sure you want to delete all annotations?"
  onConfirm={() => {
    deleteAllAnnotations();

    // Return to default mode after deletion
    // setCurrentModeTo(DEFAULT_MODE);
    openConfirmDeleteAllDialog = false;
  }}
  bind:open={openConfirmDeleteAllDialog}
/>
