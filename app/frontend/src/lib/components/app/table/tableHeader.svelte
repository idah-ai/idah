<script lang="ts">
  import { TableHeader, TableRow, TableHead } from "@/components/ui/table";
  import { cn } from "@/utils";

  let { columns }: { columns: { label: string; class?: string }[] } = $props();
</script>

<TableHeader>
  <TableRow class="hover:bg-transparent">
    {#each columns as column (column.label)}
      <TableHead class={cn("text-muted-foreground h-8 text-xs", column.class)}>
        {column.label}
      </TableHead>
    {/each}
  </TableRow>
</TableHeader>
