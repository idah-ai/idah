<script lang="ts">
  import { EyeIcon, EyeOffIcon, LockIcon, LockOpenIcon, Trash2Icon } from "@lucide/svelte";

  import Button from "@/components/ui/button/button.svelte";

  import { cn } from "@/utils";

  // Props
  interface Props {
    alwaysShow?: boolean;
    allAnnotationsHidden: boolean;
    allAnnotationsLocked: boolean;
    onToggleVisibility: () => void;
    onToggleEditability: () => void;
    onClickDelete: () => void;
  }
  let {
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
  <Button variant="ghost" size="icon-sm" onclick={handleClickVisibility}>
    {@const VisibilityIcon = allAnnotationsHidden ? EyeOffIcon : EyeIcon}
    <VisibilityIcon />
  </Button>

  <!-- BUTTON::EDITABILITY (LOCK / UNLOCK) -->
  <Button variant="ghost" size="icon-sm" onclick={handleClickEditability}>
    {@const EditibilityIcon = allAnnotationsLocked ? LockOpenIcon : LockIcon}
    <EditibilityIcon />
  </Button>

  <!-- BUTTON::DELETE -->
  <Button variant="ghost" size="icon-sm" onclick={handleClickDelete}>
    <Trash2Icon />
  </Button>
</div>
