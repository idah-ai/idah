<script lang="ts">
  import { cn } from "@/utils";
  import { HardDriveIcon } from "@lucide/svelte";

  import { projectStorageLabel, type ProjectStorageTargetSummary } from "@/data/model/setting/storage_target/utils";

  // Props
  interface Props {
    summary: ProjectStorageTargetSummary | null | undefined;
    class?: string;
  }
  let { summary, class: className }: Props = $props();
</script>

<span
  class={cn("text-muted-foreground inline-flex items-center gap-1.5 text-sm", className)}
  title={summary?.endpoint ? `${summary.endpoint} · ${summary.bucket}` : undefined}
>
  <HardDriveIcon class="size-3.5 shrink-0" />
  Files stored in {projectStorageLabel(summary)}
</span>
