<script lang="ts" generics="T extends Record">
  import { cn } from "@/utils";
  import { CheckIcon, ChevronsUpDownIcon, CircleXIcon } from "@lucide/svelte";
  import { onDestroy, onMount } from "svelte";

  import InputField from "@/components/app/forms/fields/input/input-field.svelte";
  import Button from "@/components/ui/button/button.svelte";
  import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandItem,
    CommandList,
    CommandSeparator,
  } from "@/components/ui/command";
  import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
  import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

  import type { MultipleSelectDataSourceFieldBaseProps } from "@/components/app/forms/form-field.types";
  import type { ListOptions } from "@/data/DataSource";
  import type { Record } from "@/data/model/Record";
  import type { LabelValue } from "@/utils/types";
  import type { FormEventHandler, WheelEventHandler } from "svelte/elements";

  // Props
  interface Props extends MultipleSelectDataSourceFieldBaseProps<T> {
    values: Array<string | number>;
    maxSelections?: number;
  }
  let {
    displayKey,
    valueKey = "id" as keyof T,
    dataSource,
    listOptions,
    values = [],
    maxSelections = Infinity,
    name,
    label,
    placeholder = "Select an option",
    clearable = false,
    searchKeyWithOperation,
    disabled = false,
    required = false,
    searchable = false,
    searchPlaceholder = "Search an option",
    searchValue = $bindable(""),
    hiddenChoices = [],
    disabledChoices = [],
    closeOnSelect = false,
    info,
    errors,
    class: className,
    onSelected,

    // Slots
    slotLabel,
    slotTrigger,
    slotTriggerValues,
    slotSelectAll,
    slotChoice,
    slotInfo,
    slotErrors,
  }: Props = $props();

  // Type
  type Choice = LabelValue<string | number, T>;

  // Elements
  let commandListElement: HTMLDivElement | null = $state(null);

  // Variables
  let open: boolean = $state(false);
  let choices: Choice[] = $state([]);
  let page = $state(1);
  let itemsPerPage = $state(10);
  let hasMore = $state(true);
  let loadingChoices = false;
  let choicesGeneration = 0;
  let knownChoices: Choice[] = $state([]);
  let selectedChoices = $derived(knownChoices.filter((choice) => values.includes(choice.value)));
  let allChoicesSelected = $state(false);
  let showClearButton = $derived(clearable && selectedChoices.length > 0);

  // Lifecycle
  onMount(async () => {
    await fetchChoices();

    /** Get selected choice if value is defined */
    if (values.length > 0) {
      const fetchedChoices = await Promise.all(
        values.map(async (val) => {
          const choiceRes = await dataSource.get(String(val));
          return {
            label: choiceRes.data[displayKey],
            value: choiceRes.data[valueKey],
            data: choiceRes.data,
          };
        }),
      );
      // Assuming we want to set selectedChoice to the first matched choice
      knownChoices = [...knownChoices.filter((choice) => !values.includes(choice.value)), ...fetchedChoices];
    }
  });

  onDestroy(() => {
    choicesGeneration++;
  });

  // Functions
  function openPopover(): void {
    if (!disabled) return;
    open = true;
  }

  function closePopover(): void {
    open = !closeOnSelect;
  }

  async function fetchChoices(append = false): Promise<boolean> {
    const generation = ++choicesGeneration;
    const nextPage = append ? page + 1 : 1;
    loadingChoices = true;
    try {
      if (!dataSource) throw new Error("DataSource is required");

      const listOpts: ListOptions = { ...listOptions, filters: { ...listOptions?.filters } };

      /** Set default pagination */
      if (!listOpts.pagination) listOpts.pagination = { page: nextPage, itemsPerPage };

      /** Set default sort */
      if (!listOpts.sort) listOpts.sort = ["-id"];

      if (searchable && searchValue) {
        if (!listOpts.filters) listOpts.filters = {};
        listOpts.filters[searchKeyWithOperation] = searchValue;
      } else {
        listOpts.filters = { ...listOpts.filters };
      }

      const response = await dataSource.list({ ...listOpts, count: true });
      if (generation !== choicesGeneration) return false;
      page = nextPage;
      hasMore = response.meta?.count ? response.meta?.count > page * itemsPerPage : false;

      // Return filtered choices excluding hiddenChoices
      const fetched = response.data
        .map((item) => ({
          label: item[displayKey],
          value: item[valueKey],
          disabled: disabledChoices.includes(item[valueKey]),
          data: item,
        }))
        .filter((choice) => !hiddenChoices.includes(choice.value));
      knownChoices = [
        ...knownChoices.filter((known) => !fetched.some((choice) => choice.value === known.value)),
        ...fetched,
      ];
      choices = append ? [...choices, ...fetched] : fetched;
      return true;
    } catch (error) {
      if (generation === choicesGeneration) throw error;
      return false;
    } finally {
      if (generation === choicesGeneration) loadingChoices = false;
    }
  }

  const filterChoices: FormEventHandler<HTMLInputElement> = async (event): Promise<void> => {
    searchValue = event.currentTarget.value;
    allChoicesSelected = false;
    await fetchChoices();
  };

  async function select(choice: LabelValue<string | number>): Promise<void> {
    if (values.find((v) => v == choice.value)) {
      values = values.filter((value) => value != choice.value);
    } else {
      if (values.length >= maxSelections) return;
      values = [...values, choice.value];
    }

    allChoicesSelected = false;
    closePopover();
    await onSelected?.(selectedChoices);
  }

  async function selectAll(selectedAllChoices: boolean): Promise<void> {
    allChoicesSelected = selectedAllChoices;

    if (selectedAllChoices) {
      values = choices.map((choice) => choice.value).slice(0, maxSelections);
    } else {
      values = [];
    }

    closePopover();
    await onSelected?.(selectedChoices);
  }

  async function clearSelection(event: MouseEvent): Promise<void> {
    event.stopPropagation();
    values = [];
    allChoicesSelected = false;
    closePopover();
    await onSelected?.(selectedChoices);
  }

  const scrollToPaginate: WheelEventHandler<HTMLDivElement> = async (event: WheelEvent): Promise<void> => {
    if (!event.currentTarget) return;

    if (!commandListElement) return;

    // Cast event.currentTarget to HTMLElement to access scroll properties
    const target = event.currentTarget as HTMLElement;

    // Fetch more choices if user scroll to 60% of the list
    if (event.deltaY > 0 && commandListElement.clientHeight) {
      const scrollPosition = target.scrollTop;
      const scrollHeight = target.scrollHeight;
      const clientHeight = target.clientHeight;
      const scrollPercentage = (scrollPosition / (scrollHeight - clientHeight)) * 100;

      if (scrollPercentage >= 60 && hasMore && !loadingChoices) {
        if (!(await fetchChoices(true))) return;

        if (allChoicesSelected) {
          const nextValues = choices.map((choice) => choice.value).slice(0, maxSelections);
          if (nextValues.length !== values.length || nextValues.some((value, index) => value !== values[index])) {
            values = nextValues;
            await onSelected?.(selectedChoices);
          }
        }
      }
    }
  };
</script>

<Field id={name} class={cn("", className)}>
  {#if slotLabel}
    {@render slotLabel()}
  {:else}
    <FieldLabel for={name} {required}>{label}</FieldLabel>
  {/if}

  <Popover bind:open>
    <PopoverTrigger
      class={cn("w-full justify-between", {
        "border-destructive border-1": errors,
      })}
    >
      {#if slotTrigger}
        {@render slotTrigger({ selectedChoices, clearable, disabled })}
      {:else}
        <Button
          variant="outline"
          class="w-full justify-between"
          {disabled}
          role="combobox"
          aria-expanded={open}
          onclick={openPopover}
        >
          {#if selectedChoices.length > 0}
            {#if slotTriggerValues}
              {@render slotTriggerValues({ selectedChoices })}
            {:else}
              {selectedChoices.map((choice) => choice.label).join(", ")}
            {/if}
          {:else}
            <span class="text-muted-foreground">{placeholder}</span>
          {/if}

          <div class="ml-auto inline-flex items-center gap-2">
            <button
              type="button"
              class={cn("cursor-pointer", showClearButton ? "opacity-50" : "pointer-events-none opacity-0")}
              tabindex={showClearButton ? 0 : -1}
              aria-hidden={!showClearButton}
              onclick={clearSelection}
            >
              <CircleXIcon class="size-4 shrink-0" />
            </button>

            <ChevronsUpDownIcon class="size-4 shrink-0 opacity-50" />
          </div>
        </Button>
      {/if}
    </PopoverTrigger>

    <PopoverContent align="start" class="w-auto min-w-[var(--bits-floating-anchor-width)] p-0">
      <Command>
        {#if searchable}
          <InputField
            name="filter/multiple-select/{searchKeyWithOperation}"
            class="p-2"
            placeholder={searchPlaceholder}
            value={searchValue}
            oninput={filterChoices}
          />
          <CommandSeparator />
        {/if}

        <CommandList bind:ref={commandListElement} onwheel={scrollToPaginate}>
          <CommandGroup>
            <CommandEmpty>No option found.</CommandEmpty>

            {#if slotSelectAll}
              {@render slotSelectAll({ selectAll, allChoicesSelected })}
            {/if}

            {#each choices as choice, index (index)}
              {#if slotChoice}
                {@render slotChoice({ choice, select })}
              {:else}
                <CommandItem
                  disabled={values.length >= maxSelections && !values.includes(choice.value)}
                  onclick={() => select(choice)}
                >
                  <CheckIcon
                    class={cn("mr-2 size-4", {
                      "opacity-0": !values.find((v) => v == choice.value),
                    })}
                  />

                  {choice.label}
                </CommandItem>
              {/if}
            {/each}
          </CommandGroup>
        </CommandList>
      </Command>
    </PopoverContent>
  </Popover>

  {#if slotInfo}
    {@render slotInfo()}
  {:else if info}
    <FieldDescription>{info}</FieldDescription>
  {/if}

  {#if slotErrors}
    {@render slotErrors()}
  {:else if errors}
    <FieldError>{errors}</FieldError>
  {/if}
</Field>
