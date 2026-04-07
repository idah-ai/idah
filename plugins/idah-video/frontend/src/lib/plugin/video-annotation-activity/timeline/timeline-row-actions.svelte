<script lang="ts">
  import { EyeIcon, EyeOffIcon, LockIcon, LockOpenIcon, Trash2Icon } from "@lucide/svelte";

  import Tooltips from "$lib/components/app/tooltips/tooltips.svelte";
  import Button from "$lib/components/ui/button/button.svelte";

  import { cn } from "$lib/utils";

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
  <Tooltips align="center">
    {#snippet trigger()}
      <Button variant="ghost" size="icon-sm" onclick={handleClickVisibility}>
        {@const VisibilityIcon = allAnnotationsHidden ? EyeOffIcon : EyeIcon}
        <VisibilityIcon />
      </Button>
    {/snippet}

    {#snippet content()}
      {getVisibilityTooltipContent()}
    {/snippet}
  </Tooltips>

  <!-- BUTTON::EDITABILITY (LOCK / UNLOCK) -->
  <Tooltips align="center">
    {#snippet trigger()}
      <Button variant="ghost" size="icon-sm" onclick={handleClickEditability}>
        {@const EditibilityIcon = allAnnotationsLocked ? LockOpenIcon : LockIcon}
        <EditibilityIcon />
      </Button>
    {/snippet}

    {#snippet content()}
      {getEditabilityTooltipContent()}
    {/snippet}
  </Tooltips>

  <!-- BUTTON::DELETE -->
  <Tooltips align="center">
    {#snippet trigger()}
      <Button variant="ghost" size="icon-sm" disabled={allAnnotationsLocked} onclick={handleClickDelete}>
        <Trash2Icon />
      </Button>
    {/snippet}

    {#snippet content()}
      {getDeleteTooltipContent()}
    {/snippet}
  </Tooltips>
</div>
