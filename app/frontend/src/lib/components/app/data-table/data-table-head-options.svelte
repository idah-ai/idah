<script lang="ts" generics="T extends Record">
  import { getContext } from "svelte";

  import Button from "@/components/ui/button/button.svelte";
  import Command from "@/components/ui/command/command.svelte";
  import CommandGroup from "@/components/ui/command/command-group.svelte";
  import CommandItem from "@/components/ui/command/command-item.svelte";
  import CommandList from "@/components/ui/command/command-list.svelte";
  import CommandSeparator from "@/components/ui/command/command-separator.svelte";
  import DateRangePickerField from "@/components/app/forms/fields/picker/date-range-picker-field.svelte";
  import DataTableHeadLabel from "@/components/app/data-table/data-table-head-label.svelte";
  import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

  import { cn } from "@/utils";
  import {
    ArrowDownAZIcon,
    ArrowDownZAIcon,
    ArrowUpDownIcon,
    ChevronsUpDownIcon,
    EyeOffIcon,
    type Icon as IconType,
  } from "@lucide/svelte";

  import type { ColumnSettings } from "@/components/app/data-table/data-table.types";
  import type { Record } from "@/data/model/Record";

  // Contexts
  const dataTableName: string = getContext("dataTableName");

  // Props
  interface Props {
    columnKey: string;
    columnSetting: ColumnSettings<T>;
    // Props::Functions
    onHide: (columnKey: string) => void;
  }
  let {
    columnKey,
    columnSetting,
    // Props::Functions
    onHide,
  }: Props = $props();
  let { label, align, filterable, hidable, sortable, filterComponent, filterOptions } = columnSetting;

  // Variables
  interface SortOptionItem {
    label: string;
    icon: typeof IconType;
    onSelect: () => void;
  }
  const sortOptionItems: SortOptionItem[] = [
    { label: "Sort A-Z", icon: ArrowDownAZIcon, onSelect: () => {} },
    { label: "Sort Z-A", icon: ArrowDownZAIcon, onSelect: () => {} },
    { label: "Clear sorting", icon: ArrowUpDownIcon, onSelect: () => {} },
  ];

  let openDataTableHeadOptions: boolean = $state(false);
  let isSortedOrFiltered: boolean = $state(false);
  let isSorted: boolean = $state(false);
  let search: string = $state("");
  let from: Date | null = $state(null);
  let to: Date | null = $state(null);

  // Functions
  function openPopover(): void {
    openDataTableHeadOptions = true;
  }

  function closePopover(): void {
    openDataTableHeadOptions = false;
  }
</script>

<Popover bind:open={openDataTableHeadOptions}>
  <PopoverTrigger class="my-1.5">
    {#snippet child({ props })}
      <Button
        variant={isSortedOrFiltered ? "default" : "ghost"}
        class="data-[state=open]:bg-primary data-[state=open]:text-primary-foreground hover:bg-primary hover:text-primary-foreground gap-2"
        {...props}
        onclick={openPopover}
      >
        <DataTableHeadLabel class={cn(isSorted ? "text-primary-foreground" : "text-primary")}>
          {label}

          {#if sortable || filterable}
            {#if isSorted}
              <ArrowUpDownIcon class="size-4" />
            {:else}
              <ChevronsUpDownIcon class="size-4" />
            {/if}
          {/if}
        </DataTableHeadLabel>
      </Button>
    {/snippet}
  </PopoverTrigger>

  <PopoverContent align="start" class="p-0">
    <Command>
      <CommandList>
        <!-- FILTER -->
        {#if filterable}
          <CommandGroup heading="Filter">
            {#if filterComponent}
              {@const FilterComponent = filterComponent}
              <FilterComponent this={filterComponent}></FilterComponent>
            {:else if filterOptions?.filterBy === "string"}
              Render Input
            {:else if filterOptions?.filterBy === "number-range"}
              Render Number Range Input
            {:else if filterOptions?.filterBy === "single-select"}
              Render Single Select Input
            {:else if filterOptions?.filterBy === "multiple-select"}
              Render Multiple Select Input
            {:else if filterOptions?.filterBy === "date-range"}
              <DateRangePickerField name="{dataTableName}/filter/date-range" bind:from bind:to />
            {:else if filterOptions?.filterBy === "datasource"}
              Render Data Source Input
            {/if}
          </CommandGroup>
          <!-- <CommandInput bind:value={search} placeholder="Search {dataTableName} by {columnKey}"></CommandInput> -->
        {/if}

        <!-- SORTING -->
        {#if sortable}
          <CommandGroup heading="Sort">
            {#each sortOptionItems as sortItem}
              <CommandItem onclick={sortItem.onSelect}>
                {@const SortItemIcon = sortItem.icon}
                <SortItemIcon class="size-4" />
                {sortItem.label}
              </CommandItem>
            {/each}
          </CommandGroup>
        {/if}

        <!-- HIDE -->
        {#if hidable}
          <CommandSeparator />
          <CommandGroup heading="Hide">
            <CommandItem onclick={() => onHide(columnKey)}>
              <EyeOffIcon class="size-4" />
              Hide column {label.toLowerCase()}
            </CommandItem>
          </CommandGroup>
        {/if}
      </CommandList>
    </Command>
  </PopoverContent>
</Popover>
