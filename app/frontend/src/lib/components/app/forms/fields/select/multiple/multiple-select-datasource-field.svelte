<script lang="ts" generics="T extends Record">
  import { CheckIcon, ChevronsUpDownIcon, CircleXIcon } from "@lucide/svelte";

  import InputField from "@/components/app/forms/fields/input/input-field.svelte";
  import FormFieldErrors from "@/components/app/forms/form-field-errors.svelte";
  import FormFieldInfo from "@/components/app/forms/form-field-info.svelte";
  import FormFieldLabel from "@/components/app/forms/form-field-label.svelte";
  import FormField from "@/components/app/forms/form-field.svelte";
  import Button from "@/components/ui/button/button.svelte";
  import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
  import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
  import Spinner from "@/components/ui/spinner/spinner.svelte";

  import { cn } from "@/utils";

  import type { SelectDataSourceFieldBaseProps } from "@/components/app/forms/form-field.types";
  import type { ListOptions } from "@/data/DataSource";
  import type { Record } from "@/data/model/Record";
  import type { LabelValue } from "@/utils/types";

  // Props
  interface Props extends SelectDataSourceFieldBaseProps<T> {
    values: Array<string | number | null>;
  }
  let {
    dataSource,
    listOptions,
    values = [],
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
    info,
    errors,
    class: className,
    onValueChange,

    // Slots
    slotLabel,
    slotTrigger,
    slotChoice,
    slotInfo,
    slotErrors,
  }: Props = $props();

  // Type
  type Choice = LabelValue<string | number, T>;

  // Variables
  let open: boolean = $state(false);
  let choices: Choice[] = $state([]);
  // let selectedValue
  let selectedChoice = $derived(choices.find((choice) => values.includes(choice.value)));

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

    if (searchable && searchValue) {
      if (!listOpts.filters) listOpts.filters = {};
      listOpts.filters[searchKeyWithOperation] = searchValue;
    }

    const response = await dataSource.list(listOpts);

    return response.data.map((item) => ({
      label: item.name,
      value: item.id,
      data: item,
    }));
  }

  async function select(choice: Choice): Promise<void> {
    if (values.find((v) => v == choice.value)) {
      values = values.filter((value) => value != choice.value);
    } else {
      values = [...values, choice.value];
    }
    open = false;
    await onValueChange?.(choice.value);
  }
</script>

<FormField id={name} class={cn("", className)}>
  {#if slotLabel}
    {@render slotLabel()}
  {:else}
    <FormFieldLabel {required}>{label}</FormFieldLabel>
  {/if}

  <Popover bind:open>
    <PopoverTrigger>
      {#if slotTrigger}
        {@render slotTrigger({ selectedChoice, clearable, disabled })}
      {:else}
        <Button
          variant="outline"
          class="w-full justify-between"
          {disabled}
          role="combobox"
          aria-expanded={open}
          onclick={openPopover}
        >
          {#if selectedChoice}
            {selectedChoice.label}
          {:else}
            <span class="text-muted-foreground">{placeholder}</span>
          {/if}

          <div class="ml-auto inline-flex items-center gap-2">
            <button
              type="button"
              class={cn("cursor-pointer", clearable && selectedChoice ? "opacity-50" : "opacity-0")}
              onclick={() => {}}
            >
              <CircleXIcon class="size-4 shrink-0"></CircleXIcon>
            </button>

            <ChevronsUpDownIcon class="size-4 shrink-0 opacity-50"></ChevronsUpDownIcon>
          </div>
        </Button>
      {/if}
    </PopoverTrigger>

    <PopoverContent align="start" class="w-auto p-0">
      <Command>
        {#if searchable}
          <InputField
            name="filter/multiple-select/{searchKeyWithOperation}"
            placeholder={searchPlaceholder}
            value={searchValue}
            oninput={(e) => (searchValue = e.currentTarget.value)}
          ></InputField>
        {/if}

        <CommandList>
          <CommandEmpty>No option found.</CommandEmpty>
          <CommandGroup>
            {#await initialFetchChoices()}
              <Spinner size="sm"></Spinner>
            {:then _}
              {#each choices as choice, index (index)}
                {#if slotChoice}
                  {@render slotChoice({ choice })}
                {:else}
                  <CommandItem onclick={() => select(choice)}>
                    <CheckIcon
                      class={cn("mr-2 size-4", {
                        "opacity-0": !values.find((v) => v == choice.value),
                      })}
                    ></CheckIcon>

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
    <FormFieldInfo>{info}</FormFieldInfo>
  {/if}

  {#if slotErrors}
    {@render slotErrors()}
  {:else if errors}
    <FormFieldErrors {errors}></FormFieldErrors>
  {/if}
</FormField>
