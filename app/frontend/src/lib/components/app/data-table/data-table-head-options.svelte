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
  import { Input } from "@/components/ui/input";
  import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

  import { cn } from "@/utils";
  import { delayedInput } from "@/utils/delayed";
  import {
    ArrowDownAZIcon,
    ArrowDownZAIcon,
    ArrowUpDownIcon,
    ChevronsUpDownIcon,
    EyeOffIcon,
    FunnelIcon,
    FunnelXIcon,
    type Icon as IconType,
  } from "@lucide/svelte";

  import type {
    ColumnSettings,
    FilterDataSourceParams,
    SortDataSourceParams,
    TablePreferences,
  } from "@/components/app/data-table/data-table.types";
  import type { Record } from "@/data/model/Record";
  import type { DateRange } from "bits-ui";
  import { getLocalTimeZone } from "@internationalized/date";

  // Contexts
  const dataTableName: string = getContext("dataTableName");

  // Props
  interface Props {
    columnKey: string;
    columnSetting: ColumnSettings<T>;
    tablePreferences: TablePreferences;
    // Props::Functions
    onFilter: (params: FilterDataSourceParams) => Promise<void>;
    onSort: (params: SortDataSourceParams) => Promise<void>;
    onHide: (columnKey: string) => void;
  }
  let {
    columnKey,
    columnSetting,
    tablePreferences,
    // Props::Functions
    onFilter,
    onSort,
    onHide,
  }: Props = $props();
  let { label, align, filterable, hidable, sortable, filterComponent, filterOptions } = columnSetting;

  // Variables
  interface SortOptionItem {
    label: string;
    value: string;
    icon: typeof IconType;
    onSelect: () => Promise<void> | void;
  }
  const sortOptionItems: SortOptionItem[] = [
    {
      label: "Sort A-Z",
      value: columnKey,
      icon: ArrowDownAZIcon,
      onSelect: async () => onSort({ columnKey: columnKey, sortDirection: "asc" }),
    },
    {
      label: "Sort Z-A",
      value: `-${columnKey}`,
      icon: ArrowDownZAIcon,
      onSelect: async () => onSort({ columnKey: columnKey, sortDirection: "desc" }),
    },
    {
      label: "Clear sorting",
      value: "none",
      icon: ArrowUpDownIcon,
      onSelect: async () => {
        onSort({ columnKey: columnKey, sortDirection: "none" });
        closePopover();
      },
    },
  ];

  let openDataTableHeadOptions: boolean = $state(false);

  let filterKey: string = $derived(`${filterOptions?.filterKey || columnKey}`);
  let filterKeyWithOperation: string = $derived(
    filterOptions?.filterOperation ? `${filterKey}__${filterOptions.filterOperation}` : filterKey,
  );
  let isFiltered: boolean = $derived(
    Object.keys(tablePreferences.filters).some((filterKey) => filterKey.startsWith(columnKey)),
  );
  let isSorted: boolean = $derived(tablePreferences.sort.some((currentSorting) => currentSorting.endsWith(columnKey)));
  let isSortedAsc: boolean = $derived(tablePreferences.sort.includes(columnKey));
  let isSortedDesc: boolean = $derived(tablePreferences.sort.includes(`-${columnKey}`));
  let isSortedOrFiltered: boolean = $derived(isFiltered || isSorted);

  // Functions
  function openPopover(): void {
    openDataTableHeadOptions = true;
  }

  function closePopover(): void {
    openDataTableHeadOptions = false;
  }

  function filterByInput(event: Event & { currentTarget: EventTarget & HTMLInputElement }) {
    let value = event.currentTarget.value;

    delayedInput(value, 300).then((searchValue) => {
      onFilter({
        filters: {
          [filterKeyWithOperation]: searchValue,
        },
      });
    });
  }

  function filterByDateRange(dateRange: DateRange): void {
    if (dateRange.start && dateRange.end) {
      const startDateStr = dateRange.start.toDate(getLocalTimeZone()).toISOString().split("T")[0];
      const endDateStr = dateRange.end.toDate(getLocalTimeZone()).toISOString().split("T")[0];

      onFilter({
        filters: {
          [`${filterKey}__gte`]: startDateStr,
          [`${filterKey}__lte`]: endDateStr,
        },
      });
    }
  }

  function clearFilter(): void {
    switch (filterOptions?.filterBy) {
      case "date-range":
        onFilter({
          filters: {
            [`${filterKey}__gte`]: undefined,
            [`${filterKey}__lte`]: undefined,
          },
        });
        break;

      default:
        onFilter({
          filters: {
            [filterKeyWithOperation]: undefined,
          },
        });
        break;
    }

    closePopover();
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
        <DataTableHeadLabel class={cn(isSortedOrFiltered ? "text-primary-foreground" : "text-primary")}>
          {#if isFiltered}
            <FunnelIcon class="size-4" />
          {/if}

          {label}

          {#if sortable || filterable}
            {#if isSortedAsc}
              <ArrowDownAZIcon class="size-4" />
            {:else if isSortedDesc}
              <ArrowDownZAIcon class="size-4" />
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
              {@const filterKey = `${columnKey}__${filterOptions.filterOperation || "match"}`}
              <div class="pb-2">
                <Input
                  placeholder="Search {label.toLowerCase()}"
                  value={tablePreferences.filters[filterKey]}
                  oninput={filterByInput}
                />
              </div>
            {:else if filterOptions?.filterBy === "number-range"}
              Render Number Range Input
            {:else if filterOptions?.filterBy === "single-select"}
              Render Single Select Input
            {:else if filterOptions?.filterBy === "multiple-select"}
              Render Multiple Select Input
            {:else if filterOptions?.filterBy === "date-range"}
              <DateRangePickerField
                name="{dataTableName}/filter/date-range"
                from={tablePreferences.filters[`${filterOptions.filterKey || columnKey}__gte`]}
                to={tablePreferences.filters[`${filterOptions.filterKey || columnKey}__lte`]}
                onValueChanged={filterByDateRange}
              />
            {:else if filterOptions?.filterBy === "datasource"}
              Render Data Source Input
            {/if}

            <CommandItem disabled={!isFiltered} onclick={clearFilter}>
              <FunnelXIcon class="size-4" />
              Clear filter
            </CommandItem>
          </CommandGroup>
        {/if}

        <!-- SORTING -->
        {#if sortable}
          <CommandGroup heading="Sort">
            {#each sortOptionItems as sortItem}
              <CommandItem disabled={tablePreferences.sort.includes(sortItem.value)} onclick={sortItem.onSelect}>
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
