<script lang="ts">
  import type { Snippet } from "svelte";
  import { TableHeader, TableRow, TableHead } from "@/components/ui/table";
  import { cn } from "@/utils";

  // Props
  let { columns }: { columns: { label: string; class?: string; content?: Snippet }[] } = $props();
</script>

<TableHeader>
  <TableRow class="hover:bg-transparent">
    {#each columns as column (column.label)}
      <TableHead class={cn("text-muted-foreground h-8 text-xs", column.class)}>
        {#if column.content}
          {@render column.content()}
        {:else}
          {column.label}
        {/if}
      </TableHead>
    {/each}
  </TableRow>
</TableHeader>
