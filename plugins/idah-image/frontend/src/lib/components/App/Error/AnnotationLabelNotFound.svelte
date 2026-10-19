<script lang="ts">
  import { TriangleAlertIcon } from "@lucide/svelte";

  interface Props {
    displayName: string;
  }
  let { displayName }: Props = $props();
</script>

<div class="flex flex-col gap-2">
  <div class="text-destructive inline-flex items-center gap-1">
    <TriangleAlertIcon class="size-4 shrink-0" />
    <span class="font-semibold">Label not found</span>
  </div>
  <span>
    This label <strong>{displayName}</strong> was renamed or deletred from the label configuration. Reassign this annotation
    to a valid label.
  </span>
</div>
