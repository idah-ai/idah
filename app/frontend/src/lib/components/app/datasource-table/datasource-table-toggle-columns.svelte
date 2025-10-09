<script lang="ts" generics="T extends Record">
  import { Settings2Icon } from "@lucide/svelte";

  import Button from "@/components/ui/button/button.svelte";
  import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuTrigger,
  } from "@/components/ui/dropdown-menu/index";

  import { Record } from "@/data/model/Record";

  import type { ColumnsSettings } from "@/components/app/datasource-table/types";

  // Props
  interface Props {
    columns: ColumnsSettings<T>;
  }
  let { columns = $bindable() }: Props = $props();

  // Variables
  let hidableColumns = $derived(
    Object.fromEntries(Object.entries(columns).filter(([_columnKey, columnSetting]) => columnSetting.hidable)),
  );
</script>

<DropdownMenu>
  <DropdownMenuTrigger>
    {#snippet child({ props })}
      <Button variant="outline" {...props}>
        <Settings2Icon class="size-4"></Settings2Icon>
        Toggle Columns
      </Button>
    {/snippet}
  </DropdownMenuTrigger>

  <DropdownMenuContent align="end" class="min-w-[160px]">
    <DropdownMenuGroup>
      {#each Object.entries(hidableColumns) as [columnKey, columnSetting] (columnKey)}
        {@const { label } = columnSetting}
        <DropdownMenuCheckboxItem bind:checked={columnSetting.visible}>{label}</DropdownMenuCheckboxItem>
      {/each}
    </DropdownMenuGroup>
  </DropdownMenuContent>
</DropdownMenu>
