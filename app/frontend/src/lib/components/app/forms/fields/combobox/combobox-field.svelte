<script lang="ts" generics="T extends Record">
  import { CheckIcon, ChevronsUpDownIcon } from "@lucide/svelte";
  import { Combobox } from "bits-ui";
  import { onMount } from "svelte";

  import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
  import Spinner from "@/components/ui/spinner/spinner.svelte";

  import { Record } from "@/data/model/Record";
  import { cn } from "@/utils";
  import { delayedInput } from "@/utils/delayed";

  import type { SingleSelectDataSourceFieldBaseProps } from "@/components/app/forms/form-field.types";
  import type { LabelValue } from "@/utils/types";

  // Props
  interface Props extends SingleSelectDataSourceFieldBaseProps<T> {
    value: string | number | null;
    onInput?: () => void;
  }
  let {
    dataSource,
    searchKeyWithOperation,
    displayKey,
    valueKey = "id",
    listOptions,
    value = $bindable(null),
    name,
    label,
    placeholder = "Select an option",
    disabled = false,
    disabledChoices = [],
    hiddenChoices = [],
    // clearable = false,
    required = false,
    info,
    errors,
    class: className,
    onSelected,
    onInput,
    slotLabel,
    slotChoice,
    slotInfo,
    slotErrors,
  }: Props = $props();

  // Variables
  let filtering = $state(false);
  let filteredChoices = $state<LabelValue<string | number>[]>([]);
  let inputValue = $state("");
  let selectedLabel = $state("");

  // Convert external value to string for bits-ui controlled value
  let comboboxValue = $derived(value != null ? String(value) : undefined);

  // Functions
  async function filterChoices(searchVal: string) {
    filtering = true;

    await delayedInput(searchVal, 300).then(async (searchValue) => {
      const res = await dataSource.list({
        ...listOptions,
        filters: {
          ...listOptions?.filters,
          [searchKeyWithOperation]: searchValue,
        },
      });

      filteredChoices = res.data
        .filter((record) => !hiddenChoices.includes(record[valueKey]))
        .map((record) => ({
          label: record[displayKey],
          value: record[valueKey],
          disabled: disabledChoices.includes(record[valueKey]),
          data: record,
        }));

      filtering = false;
    });
  }

  function onValueChange(newValue: string | undefined): void {
    if (!newValue) {
      value = null;
      selectedLabel = "";
      onSelected?.(null);
      filterChoices("");
      return;
    }

    // Find the choice to get its typed value and label
    const choice = filteredChoices.find((c) => String(c.value) === newValue);
    if (choice) {
      value = choice.value;
      selectedLabel = String(choice.label);
      onSelected?.(value);
    }
  }

  function onComboboxInput(e: Event): void {
    const newValue = (e.currentTarget as HTMLInputElement).value;
    inputValue = newValue;

    // bits-ui auto-fills input after selection — don't clear the selection
    if (newValue === selectedLabel) {
      filterChoices(newValue);
      return;
    }
    selectedLabel = "";

    // Clear selection if input is fully cleared — reload all choices
    if (!newValue) {
      if (value !== null) {
        value = null;
        onSelected?.(null);
      }
      return;
    }

    // When user starts typing a new value, clear previous selection
    if (value !== null) {
      value = null;
      onSelected?.(null);
    }
    // Trigger async filter for dropdown
    filterChoices(newValue);

    onInput?.();
  }

  function onBlur(): void {
    // If user types free-text without selecting a choice → commit as free-text value
    if (inputValue && value === null) {
      onSelected?.(inputValue);
    }
  }

  // Lifecycle
  onMount(() => {
    filterChoices("");
  });
</script>

{#snippet emptyState()}
  {#if filtering}
    <Spinner class="mx-auto h-full" />
  {:else}
    <span class="text-muted-foreground block p-2 text-sm"> No results found. </span>
  {/if}
{/snippet}

{#snippet choiceItem(choice: LabelValue<string | number>)}
  <Combobox.Item
    class={cn(
      "rounded-button data-highlighted:bg-muted flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none",
      {
        "text-muted-foreground cursor-not-allowed": choice.disabled,
      },
    )}
    value={String(choice.value)}
    label={choice.label}
    disabled={choice.disabled}
  >
    {choice.label}

    {#if String(choice.value) === comboboxValue}
      <div class="ml-auto">
        <CheckIcon class="size-4" />
      </div>
    {/if}
  </Combobox.Item>
{/snippet}

<Field id={name} class={cn("", className)}>
  {#if slotLabel}
    {@render slotLabel()}
  {:else}
    <FieldLabel for={name} {required}>{label}</FieldLabel>
  {/if}

  <Combobox.Root type="single" value={comboboxValue} {onValueChange}>
    <div class="relative">
      <Combobox.Input
        class={cn(
          "selection:bg-primary dark:bg-input/30 selection:text-primary-foreground border-input ring-offset-background placeholder:text-muted-foreground flex h-9 w-full min-w-0 rounded-md border bg-transparent px-3 text-sm font-medium shadow-xs transition-[color,box-shadow] outline-none disabled:cursor-not-allowed disabled:opacity-50",
          "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
          "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        )}
        oninput={onComboboxInput}
        onblur={onBlur}
        autofocus={false}
        {disabled}
        {placeholder}
        aria-invalid={errors && errors.length > 0 ? "true" : "false"}
      ></Combobox.Input>

      <Combobox.Trigger class="absolute end-2 top-1/2 size-4 -translate-y-1/2 touch-none">
        <ChevronsUpDownIcon class="text-muted-foreground size-4" />
      </Combobox.Trigger>
    </div>

    <Combobox.Portal>
      <Combobox.Content
        class="focus-override border-muted bg-background shadow-popover data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 max-h-[var(--bits-combobox-content-available-height)] w-auto min-w-[var(--bits-combobox-anchor-width)] rounded-lg border p-1 outline-hidden select-none data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1"
        align="start"
        sideOffset={4}
      >
        <Combobox.Viewport class="p-1">
          {#each filteredChoices as choice (choice.value)}
            {#if slotChoice}
              {@render slotChoice({
                choice,
                select: (c: LabelValue<string | number>) => onValueChange(String(c.value)),
              })}
            {:else}
              {@render choiceItem(choice)}
            {/if}
          {:else}
            {@render emptyState()}
          {/each}
        </Combobox.Viewport>
      </Combobox.Content>
    </Combobox.Portal>
  </Combobox.Root>

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
