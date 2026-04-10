<script lang="ts">
  import { getContext } from "svelte";
  import { EyeIcon, EyeOffIcon, LockIcon, LockOpenIcon, Trash2Icon } from "@lucide/svelte";

  import Button from "$lib/components/ui/button/button.svelte";
  import { getShortcut } from "$lib/components/ui/kbd/utils";
  import ToolTooltip from "$lib/components/app/tooltips/tool-tooltip.svelte";
  import { cn } from "$lib/utils";

  import type { IActivityContext } from "$idah/context/activity-context";

  // Context
  const context: IActivityContext = getContext("context");

  // Props
  interface Props {
    mode: "single" | "multiple";
    alwaysShow?: boolean;
    allAnnotationsHidden: boolean;
    allAnnotationsLocked: boolean;
    onToggleVisibility: () => void;
    onToggleEditability: () => void;
    onClickDelete: () => void;
  }
  let {
    mode,
    alwaysShow = false,
    allAnnotationsHidden,
    allAnnotationsLocked,
    onToggleVisibility,
    onToggleEditability,
    onClickDelete,
  }: Props = $props();

  // Functions
  function handleClickVisibility(e: MouseEvent) {
    e.stopPropagation();
    onToggleVisibility();
  }

  function handleClickEditability(e: MouseEvent) {
    e.stopPropagation();
    onToggleEditability();
  }

  function handleClickDelete(e: MouseEvent) {
    e.stopPropagation();
    onClickDelete();
  }

  function getVisibilityTooltipContent() {
    switch (mode) {
      case "multiple": {
        if (allAnnotationsHidden) return "Show all";
        return "Hide all";
      }

      case "single": {
        if (allAnnotationsHidden) return "Show";
        return "Hide";
      }
    }
  }

  function getEditabilityTooltipContent() {
    switch (mode) {
      case "multiple": {
        if (allAnnotationsLocked) return "Unlock all";
        return "Lock all";
      }

      case "single": {
        if (allAnnotationsLocked) return "Unlock";
        return "Lock";
      }
    }
  }

  function getDeleteTooltipContent() {
    switch (mode) {
      case "multiple": {
        return "Delete all";
      }

      case "single": {
        return "Delete";
      }
    }
  }
</script>

<div
  class={cn(
    "group/timeline-row-actions ml-auto flex shrink-0 items-center gap-0",
    alwaysShow ? "block" : "hidden group-hover/timeline-row-header:block",
  )}
>
  <!-- BUTTON::VISIBILITY (SHOW / HIDE) -->
  <ToolTooltip
    align="center"
    label={getVisibilityTooltipContent()}
    shortcut={mode === "single" ? getShortcut(context.shortcutReferences?.["selected.toggle_group_visibility"]?.keyCombinations) : undefined}
  >
    {#snippet trigger()}
      <Button variant="ghost" size="icon-sm" onclick={handleClickVisibility}>
        {@const VisibilityIcon = allAnnotationsHidden ? EyeIcon : EyeOffIcon}
        <VisibilityIcon />
      </Button>
    {/snippet}
  </ToolTooltip>

  <!-- BUTTON::EDITABILITY (LOCK / UNLOCK) -->
  <ToolTooltip
    align="center"
    label={getEditabilityTooltipContent()}
    shortcut={mode === "single" ? getShortcut(context.shortcutReferences?.["selected.toggle_group_editability"]?.keyCombinations) : undefined}
  >
    {#snippet trigger()}
      <Button variant="ghost" size="icon-sm" onclick={handleClickEditability}>
        {@const EditibilityIcon = allAnnotationsLocked ? LockIcon : LockOpenIcon}
        <EditibilityIcon />
      </Button>
    {/snippet}
  </ToolTooltip>

  <!-- BUTTON::DELETE -->
  <ToolTooltip
    align="center"
    label={getDeleteTooltipContent()}
    shortcut={mode === "single" ? getShortcut(context.shortcutReferences?.["selected.delete"]?.keyCombinations) : undefined}
  >
    {#snippet trigger()}
      <Button variant="ghost" size="icon-sm" disabled={allAnnotationsLocked} onclick={handleClickDelete}>
        <Trash2Icon />
      </Button>
    {/snippet}
  </ToolTooltip>
</div>
