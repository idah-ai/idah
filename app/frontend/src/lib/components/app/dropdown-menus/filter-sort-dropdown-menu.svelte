<script lang="ts" generics="T extends Record">
  import { CalendarDate, parseDate } from "@internationalized/date";
  import {
    ArrowDownAZIcon,
    ArrowDownZAIcon,
    ArrowUpDownIcon,
    CheckIcon,
    EyeOffIcon,
    FunnelIcon,
    FunnelXIcon,
    SquareCheckBigIcon,
    SquareIcon,
    type Icon as IconType,
  } from "@lucide/svelte";
  import type { DateRange } from "bits-ui";
  import { addDays, addMonths, endOfMonth, endOfWeek, startOfWeek } from "date-fns";
  import type { Snippet } from "svelte";

  import NumberField from "@/components/app/forms/fields/input/number-field.svelte";
  import Button from "@/components/ui/button/button.svelte";
  import { Command, CommandGroup, CommandItem, CommandSeparator } from "@/components/ui/command";
  import { Input } from "@/components/ui/input";
  import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
  import RangeCalendar from "@/components/ui/range-calendar/range-calendar.svelte";

  import { Record } from "@/data/model/Record";
  import { cn } from "@/utils";
  import { delayedInput } from "@/utils/delayed";

  import type {
    ColumnSettings,
    FilterDataSourceParams,
    SortDataSourceParams,
  } from "@/components/app/datasource-table/types";
  import type { Sort } from "@/data/DataSource";
  import type { Filters } from "@/data/filtering";
  import type { Hash } from "@/utils/types";
  import { page } from "$app/state";
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";

  // Props
  interface Props<T extends Record> {
    columnKey: string;
    columnSetting: ColumnSettings<T>;
    contexts?: Hash;

    // DataSource
    filters: Filters;
    sort: Sort;

    // Functions
    onFilter: (params: FilterDataSourceParams) => Promise<void>;
    onSort: (params: SortDataSourceParams) => Promise<void>;
    onHide(columnKey: string): void;

    // Slots
    trigger?: Snippet<
      [
        {
          label: string;
          sortable: boolean;
          filterable: boolean;
          isSorting: boolean;
          isSortingAsc: boolean;
          isSortingDesc: boolean;
          isFiltering: boolean;
        },
      ]
    >;
  }
  let {
    columnKey,
    columnSetting,
    contexts,

    // DataSource
    filters,
    sort,

    // Functions
    onFilter,
    onSort,
    onHide,

    // Slots
    trigger,
  }: Props<T> = $props();

  // Variables
  let openDropdown: boolean = $state(false);

  let { label, filterable, hidable, sortable, filterComponent, filterOptions } = columnSetting;
  let filterKey: string = $derived(`${filterOptions?.filterKey || columnKey}`);
  let filterKeyWithOperation: string = $derived(
    filterOptions?.filterOperation ? `${filterKey}__${filterOptions.filterOperation}` : filterKey,
  );
  let popoverAlignment: "start" | "center" = $derived.by(() => {
    if (!filterOptions?.filterBy) return "start";

    if (["date-range"].includes(filterOptions.filterBy)) {
      return "center";
    }

    return "start";
  });

  let isFiltering = $derived(Object.keys(filters).some((key) => key.startsWith(filterKey)));
  let isSorting = $derived(sort.some((s) => s.endsWith(columnKey)));
  let isSortingAsc = $derived(sort.includes(columnKey));
  let isSortingDesc = $derived(sort.includes(`-${columnKey}`));
  let isFilteringOrSorting = $derived(isFiltering || isSorting);

  let filteredStartDate: string | undefined = $derived(filters[`${filterOptions?.filterKey || columnKey}__gte`]);
  let filteredEndDate: string | undefined = $derived(filters[`${filterOptions?.filterKey || columnKey}__lte`]);
  let filteredStartDateValue: CalendarDate | undefined = $derived(
    filteredStartDate ? parseDate(filteredStartDate.split(" ")[0]) : undefined,
  );
  let filteredEndDateValue: CalendarDate | undefined = $derived(
    filteredEndDate ? parseDate(filteredEndDate.split(" ")[0]) : undefined,
  );

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
        closeDropdown();
      },
    },
  ];

  const datePresets = {
    today: { label: "Today" },
    yesterday: { label: "Yesterday" },
    thisWeek: { label: "This Week" },
    lastWeek: { label: "Last Week" },
    thisMonth: { label: "This Month" },
    lastMonth: { label: "Last Month" },
  };

  // Functions
  function closeDropdown(): void {
    openDropdown = false;
  }

  function filterByInput(event: Event & { currentTarget: EventTarget & HTMLInputElement }): void {
    const value = event.currentTarget.value;

    delayedInput(value, 300).then((searchValue) => {
      onFilter({
        filters: {
          [filterKeyWithOperation]: searchValue,
        },
      });
    });
  }

  function filterByNumber(
    control: "min" | "max",
    event: Event & { currentTarget: EventTarget & HTMLInputElement },
  ): void {
    const value = event.currentTarget.value;
    const isMin = control === "min";
    const isMax = control === "max";

    /** If value is empty, clear the filter */
    if (value === "") {
      onFilter({
        filters: {
          [`${filterKey}__gte`]: isMin ? undefined : filters[`${filterKey}__gte`],
          [`${filterKey}__lte`]: isMax ? undefined : filters[`${filterKey}__lte`],
        },
      });
      return;
    }

    /** Get the current filter values */
    const minValue = isMin ? Number(value) : filters[`${filterKey}__gte`] || undefined;
    const maxValue = isMax ? Number(value) : filters[`${filterKey}__lte`] || undefined;

    onFilter({
      filters: {
        [`${filterKey}__gte`]: minValue,
        [`${filterKey}__lte`]: maxValue,
      },
    });
  }

  function filterByBoolean(value: string | number | boolean): void {
    onFilter({
      filters: {
        [filterKey]: value,
      },
    });
  }

  function filterByMultipleSelect(value: boolean | string): void {
    const filterKey = `${filterOptions?.filterKey || columnKey}`;
    const filterKeyWithOperation = `${filterKey}__${filterOptions?.filterOperation || "in"}`;
    const currentValues: (string | boolean)[] = filters[filterKeyWithOperation] || [];
    let updatedValues: (string | boolean)[];

    if (currentValues.includes(value)) {
      updatedValues = currentValues.filter((currentValue) => currentValue !== value);
    } else {
      updatedValues = [...currentValues, value];
    }

    onFilter({ filters: { [filterKeyWithOperation]: updatedValues.length > 0 ? updatedValues : undefined } });
  }

  function filterByDateRange(dateRange: DateRange): void {
    if (dateRange.start && dateRange.end) {
      const formattedStartDate = dateRange.start.toString().concat(" 00:00:00");
      const formattedEndDate = dateRange.end.toString().concat(" 23:59:59");

      onFilter({
        filters: {
          [`${filterKey}__gte`]: formattedStartDate,
          [`${filterKey}__lte`]: formattedEndDate,
        },
      });
    }
  }

  function filterByDateRangePreset(preset: keyof typeof datePresets): void {
    const today = new Date();

    let filterStartDate: Date;
    let filterEndDate: Date;

    switch (preset) {
      case "today": {
        filterStartDate = today;
        filterEndDate = today;
        break;
      }

      case "yesterday": {
        const yesterday = addDays(today, -1);
        filterStartDate = yesterday;
        filterEndDate = yesterday;
        break;
      }

      case "thisWeek": {
        const weekStartDate = startOfWeek(today, { weekStartsOn: 2 });
        const weekEndDate = endOfWeek(today, { weekStartsOn: 2 });
        filterStartDate = weekStartDate;
        filterEndDate = weekEndDate;
        break;
      }

      case "lastWeek": {
        const lastWeek = addDays(today, -7);
        const lastWeekStartDate = startOfWeek(lastWeek, { weekStartsOn: 2 });
        const lastWeekEndDate = endOfWeek(lastWeek, { weekStartsOn: 2 });
        filterStartDate = lastWeekStartDate;
        filterEndDate = lastWeekEndDate;
        break;
      }

      case "thisMonth": {
        const thisMonthStartDate = new Date(today.getFullYear(), today.getMonth(), 1);
        const thisMonthEndDate = endOfMonth(today);
        filterStartDate = thisMonthStartDate;
        filterEndDate = thisMonthEndDate;
        break;
      }

      case "lastMonth": {
        const lastMonth = addMonths(today, -1);
        const lastMonthStartDate = new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1);
        const lastMonthEndDate = endOfMonth(lastMonth);
        filterStartDate = lastMonthStartDate;
        filterEndDate = lastMonthEndDate;
        break;
      }

      default: {
        // For other presets, just set both dates to today as a fallback
        filterStartDate = today;
        filterEndDate = today;
        break;
      }
    }

    onFilter({
      filters: {
        [`${filterKey}__gte`]: filterStartDate.toISOString().split("T")[0].concat(" 00:00:00"),
        [`${filterKey}__lte`]: filterEndDate.toISOString().split("T")[0].concat(" 23:59:59"),
      },
    });
  }

  function clearFilter(): void {
    const filterKey = `${filterOptions?.filterKey || columnKey}`;
    const filterKeyGte = `${filterKey}__gte`;
    const filterKeyLte = `${filterKey}__lte`;
    const filterKeyWithOperation = `${filterKey}__${filterOptions?.filterOperation || "in"}`;

    onFilter({
      filters: {
        [filterKey]: undefined,
        [filterKeyGte]: undefined,
        [filterKeyLte]: undefined,
        [filterKeyWithOperation]: undefined,
      },
    });

    const newURL = new URL(page.url.href);
    const searchParams = newURL.searchParams;

    // Optionally remove URL search params if any
    if (searchParams.get(filterKey)) searchParams.delete(filterKey);
    if (searchParams.get(filterKeyGte)) searchParams.delete(filterKeyGte);
    if (searchParams.get(filterKeyLte)) searchParams.delete(filterKeyLte);
    if (searchParams.get(filterKeyWithOperation)) searchParams.delete(filterKeyWithOperation);

    // If any search params were removed, update the URL
    if (newURL.href !== page.url.href) {
      goto(resolve((newURL.pathname + newURL.search) as "/projects/[projectId]/datasets/[datasetId]/entries"), {
        replaceState: true,
      });
    }
  }
</script>

<Popover bind:open={openDropdown}>
  <PopoverTrigger>
    {#if trigger}
      {@render trigger({ label, sortable, filterable, isSorting, isSortingAsc, isSortingDesc, isFiltering })}
    {:else}
      <Button
        variant={isFilteringOrSorting ? "default" : "ghost"}
        data-state={openDropdown ? "open" : "closed"}
        class={cn(
          "data-[state=open]:bg-primary data-[state=open]:text-primary-foreground hover:bg-primary hover:text-primary-foreground my-2 gap-2 font-normal",
          isFilteringOrSorting ? "text-primary-foreground" : "text-primary",
        )}
      >
        {#if filterable}
          {#if isFiltering}
            <FunnelIcon />
            <div class="absolute top-2 left-[1.4rem] size-2 animate-pulse rounded-full bg-amber-500"></div>
          {:else}
            <FunnelIcon />
          {/if}
        {/if}

        {label}

        {#if sortable}
          {#if isSortingAsc}
            <ArrowDownAZIcon />
          {:else if isSortingDesc}
            <ArrowDownZAIcon />
          {:else}
            <ArrowUpDownIcon />
          {/if}
        {/if}
      </Button>
    {/if}
  </PopoverTrigger>

  <PopoverContent align={popoverAlignment} class="w-auto min-w-60 p-0">
    <Command>
      <!-- FILTER -->
      {#if filterable}
        <CommandGroup heading="Filter">
          {#if filterComponent}
            {@const FilterComponent = filterComponent}
            <FilterComponent {columnSetting} {filters} {contexts} {onFilter}></FilterComponent>
          {:else if filterOptions?.filterBy === "string"}
            {@const filterKey = `${columnKey}__${filterOptions.filterOperation || "match"}`}
            <div class="pb-2">
              <Input placeholder="Search {label.toLowerCase()}" value={filters[filterKey]} oninput={filterByInput} />
            </div>
          {:else if filterOptions?.filterBy === "boolean"}
            {#if filterOptions.choices}
              {#each filterOptions.choices as choice (choice.value)}
                <CommandItem onclick={() => filterByBoolean(choice.value)}>
                  <CheckIcon
                    class={cn("mr-2 size-4", {
                      "opacity-0": filters[filterKey] !== choice.value,
                    })}
                  ></CheckIcon>

                  {choice.label}
                </CommandItem>
              {/each}
            {:else}
              Please provide choices for boolean filter
            {/if}
          {:else if filterOptions?.filterBy === "number-range"}
            <div class="flex items-center gap-2 px-2">
              <!-- MIN -->
              <NumberField
                name={filterKeyWithOperation}
                label="Min"
                placeholder="Minimum"
                value={filters[`${filterKey}__gte`]}
                oninput={(e) => filterByNumber("min", e)}
              ></NumberField>
              <!-- MAX -->
              <NumberField
                name={filterKeyWithOperation}
                label="Max"
                placeholder="Maximum"
                value={filters[`${filterKey}__lte`]}
                oninput={(e) => filterByNumber("max", e)}
              ></NumberField>
            </div>
          {:else if filterOptions?.filterBy === "multiple-select"}
            {#if filterOptions.choices}
              {#each filterOptions.choices as choice (choice.value)}
                {@const isSelected = filters[filterKeyWithOperation]?.includes(choice.value)}

                <CommandItem
                  class={cn("", { "bg-primary/10": isSelected })}
                  onclick={() => filterByMultipleSelect(choice.value as boolean)}
                >
                  {#if isSelected}
                    <SquareCheckBigIcon class="mr-2 size-4"></SquareCheckBigIcon>
                  {:else}
                    <SquareIcon class="mr-2 size-4"></SquareIcon>
                  {/if}

                  {choice.label}
                </CommandItem>
              {/each}
            {:else}
              Please provide choices for multiple select filter
            {/if}
          {:else if filterOptions?.filterBy === "date-range"}
            <div class="flex min-w-fit items-center">
              <div class="flex flex-col gap-2">
                {#each Object.entries(datePresets) as [key, preset] (key)}
                  <Button
                    variant="ghost"
                    size="sm"
                    class="hover:bg-primary/10 font-normal"
                    onclick={() => filterByDateRangePreset(key as keyof typeof datePresets)}
                  >
                    {preset.label}
                  </Button>
                {/each}
              </div>
              <RangeCalendar
                value={{
                  start: filteredStartDateValue,
                  end: filteredEndDateValue,
                }}
                weekStartsOn={1}
                numberOfMonths={2}
                onValueChange={filterByDateRange}
              ></RangeCalendar>
            </div>
          {:else if filterOptions?.filterBy === "datasource"}
            Render Data Source Input
          {/if}

          <CommandItem disabled={!isFiltering} onclick={clearFilter}>
            <FunnelXIcon class="size-4"></FunnelXIcon>
            Clear filter
          </CommandItem>
        </CommandGroup>
      {/if}

      <!-- SORT -->
      {#if sortable}
        <CommandGroup heading="Sort">
          {#each sortOptionItems as { label, value, icon: Icon, onSelect } (value)}
            <CommandItem disabled={sort.includes(value)} onclick={onSelect}>
              <Icon class="size-4"></Icon>
              {label}
            </CommandItem>
          {/each}
        </CommandGroup>
      {/if}

      <!-- HIDE -->
      {#if hidable}
        <CommandSeparator></CommandSeparator>
        <CommandGroup heading="Hide">
          <CommandItem onclick={() => onHide(columnKey)}>
            <EyeOffIcon class="size-4"></EyeOffIcon>
            Hide column {label.toLowerCase()}
          </CommandItem>
        </CommandGroup>
      {/if}
    </Command>
  </PopoverContent>
</Popover>
