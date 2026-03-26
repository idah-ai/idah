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
      {mode === "multiple" ? "Toggle hide / show all" : "Toggle hide / show"}
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
      {mode === "multiple" ? "Toggle lock / unlock all" : "Toggle lock / unlock"}
    {/snippet}
  </Tooltips>

  <!-- BUTTON::DELETE -->
  <Tooltips align="center">
    {#snippet trigger()}
      <Button variant="ghost" size="icon-sm" onclick={handleClickDelete}>
        <Trash2Icon />
      </Button>
    {/snippet}

    {#snippet content()}
      {mode === "multiple" ? "Delete all" : "Delete"}
    {/snippet}
  </Tooltips>
</div>
