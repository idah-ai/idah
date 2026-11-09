<script lang="ts">
  import { cn } from "@/utils";

  import type { ZipFileReport } from "@/data/model/media/medias/medias-record";

  // The skipped or failed files of an upload summary row, one line each: path, then why.
  interface Props {
    label: string;
    items: Array<ZipFileReport>;
    variant: "skipped" | "error";
  }
  let { label, items, variant }: Props = $props();

  const reasonColor = $derived(variant === "skipped" ? "text-amber-700 dark:text-amber-300" : "text-destructive");
</script>

<section class="flex flex-col gap-1">
  <p class="text-muted-foreground text-xs font-semibold">{label}</p>
  <ul class="flex max-h-40 flex-col gap-0.5 overflow-y-auto">
    {#each items as item, idx (idx)}
      <li class="flex min-w-0 items-baseline gap-2 text-xs">
        <span class="min-w-0 truncate" title={item.filename}>{item.filename}</span>
        <span class={cn("shrink-0", reasonColor)}>{item.message}</span>
      </li>
    {/each}
  </ul>
</section>
