<script lang="ts">
  import type { ComponentProps, Snippet } from "svelte";
  import Table from "@/components/ui/table/table.svelte";
  import DataTablePaginator from "@/components/app/datasource-table/datasource-table-paginator.svelte";

  let {
    label,
    class: className,
    loading,
    pagination,
    children,
  }: {
    label: string;
    class?: string;
    loading: boolean;
    pagination: ComponentProps<typeof DataTablePaginator>;
    children: Snippet;
  } = $props();
</script>

<div class="px-6" aria-busy={loading}>
  <div class="overflow-x-auto">
    <Table aria-label={label} class={className}>
      {@render children()}
    </Table>
  </div>
  <div class="py-3">
    <DataTablePaginator {...pagination} />
  </div>
</div>
