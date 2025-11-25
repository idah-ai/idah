<script lang="ts" generics="T extends Record">
  import { CheckIcon, ChevronsUpDownIcon, CircleXIcon } from "@lucide/svelte";
  import { onMount } from "svelte";
  import type { FormEventHandler } from "svelte/elements";

  import InputField from "@/components/app/forms/fields/input/input-field.svelte";
  import Button from "@/components/ui/button/button.svelte";
  import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
  import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
  import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
  import Spinner from "@/components/ui/spinner/spinner.svelte";

  import { cn } from "@/utils";

  import type { SingleSelectDataSourceFieldBaseProps } from "@/components/app/forms/form-field.types";
  import type { ListOptions } from "@/data/DataSource";
  import type { Record } from "@/data/model/Record";
  import type { LabelValue } from "@/utils/types";

  // Props
  interface Props extends SingleSelectDataSourceFieldBaseProps<T> {
    value: string | number | null;
  }

  let {
    displayKey,
    valueKey = "id" as keyof T,
    dataSource,
    listOptions,
    value = null,
    name,
    label,
    placeholder = "Select an option",
    searchable = false,
    searchPlaceholder = "Search an option",
    searchValue = $bindable(""),
    hiddenChoices = [],
    disabledChoices = [],
    clearable = false,
    searchKeyWithOperation,
    disabled = false,
    required = false,
    info,
    errors,
    class: className,
    onSelected,

    // Slots
    slotLabel,
    slotTrigger,
    slotChoice,
    slotInfo,
    slotErrors,
  }: Props = $props();

  // Type
  type Choice = LabelValue<string | number, T>;

  // Lifecycle
  onMount(async () => {
    /** Get selected choice if value is defined */
    if (value) {
      const choiceRes = await dataSource.get(String(value));
      selectedChoice = {
        label: choiceRes.data[displayKey],
        value: choiceRes.data[valueKey],
        data: choiceRes.data,
      };
    }
  });

  // Variables
  let open: boolean = $state(false);
  let choices: Choice[] = $state([]);
  let selectedChoice = $derived(choices.find((choice) => choice.value == value));

  // Functions
  function openPopover(): void {
    if (!disabled) return;
    open = true;
  }

  async function initialFetchChoices(): Promise<void> {
    choices = await fetchChoices();
  }

  async function fetchChoices(): Promise<Choice[]> {
    if (!dataSource) throw new Error("DataSource is required");

    const listOpts: ListOptions = { ...listOptions };

    /** Set default pagination */
    if (!listOpts.pagination) listOpts.pagination = { page: 1, itemsPerPage: 10 };

    /** Set default sort */
    if (!listOpts.sort) listOpts.sort = ["-id"];

    if (searchValue) {
      listOpts.filters = {
        ...listOpts.filters,
        [searchKeyWithOperation]: searchValue,
      };
    }

    const response = await dataSource.list(listOpts);

    // Return filtered choices excluding hiddenChoices
    return response.data
      .map((item) => ({
        label: item[displayKey],
        value: item[valueKey],
        disabled: disabledChoices.includes(item[valueKey]),
        data: item,
      }))
      .filter((choice) => !hiddenChoices.includes(choice.value));
  }

  const filterChoices: FormEventHandler<HTMLInputElement> = async (event) => {
    searchValue = event.currentTarget.value;
    choices = await fetchChoices();
  };

  async function select(choice: LabelValue<string | number>): Promise<void> {
    value = choice.value;
    open = false;
    await onSelected?.(value);
  }

  function clearSelection(event: MouseEvent): void {
    event.stopPropagation();
    value = null;
  }
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
        {@render slotTrigger({ selectedChoice, clearable, disabled })}
      {:else}
        <Button
          variant="outline"
          class={cn("w-full justify-between", {})}
          {disabled}
          role="combobox"
          aria-expanded={open}
          onclick={openPopover}
        >
          {#if selectedChoice}
            <span class="truncate">{selectedChoice.label}</span>
          {:else}
            <span class="text-muted-foreground">{placeholder}</span>
          {/if}

          <div class="ml-auto inline-flex items-center gap-2">
            <button
              type="button"
              class={cn("cursor-pointer", clearable && selectedChoice ? "opacity-50" : "opacity-0")}
              onclick={clearSelection}
            >
              <CircleXIcon class="size-4 shrink-0"></CircleXIcon>
            </button>

            <ChevronsUpDownIcon class="size-4 shrink-0 opacity-50" />
          </div>
        </Button>
      {/if}
    </PopoverTrigger>

    <PopoverContent align="start" class="w-auto min-w-80 p-0">
      <Command>
        <CommandList>
          <CommandGroup>
            {#if searchable}
              <InputField
                name="filter/single-select/{searchKeyWithOperation}"
                class="pb-2"
                placeholder={searchPlaceholder}
                value={searchValue}
                oninput={filterChoices}
              />
            {/if}

            <CommandEmpty>No option found.</CommandEmpty>

            {#await initialFetchChoices()}
              <Spinner size="sm" />
            {:then _}
              {#each choices as choice, index (index)}
                {#if slotChoice}
                  {@render slotChoice({ choice, select })}
                {:else}
                  <CommandItem onclick={() => select(choice)}>
                    <CheckIcon
                      class={cn("mr-2 size-4", {
                        "opacity-0": choice.value != value,
                      })}
                    />

                    {choice.label}
                  </CommandItem>
                {/if}
              {/each}
            {/await}
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
