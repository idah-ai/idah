<script lang="ts">
  import { EyeIcon, LockIcon, Trash2Icon } from "@lucide/svelte";

  import Button from "@/components/ui/button/button.svelte";
  import { cn } from "@/utils";

  // Props
  interface Props {
    alwaysShow?: boolean;
  }
  let { alwaysShow = false }: Props = $props();
</script>

<div
  class={cn(
    "group/timeline-row-actions ml-auto flex shrink-0 items-center gap-0",
    alwaysShow ? "block" : "hidden group-hover/timeline-row-header:block",
  )}
>
  <Button variant="ghost" size="icon-sm">
    <EyeIcon />
  </Button>
  <Button variant="ghost" size="icon-sm">
    <LockIcon />
  </Button>
  <Button variant="ghost" size="icon-sm">
    <Trash2Icon />
  </Button>
</div>
