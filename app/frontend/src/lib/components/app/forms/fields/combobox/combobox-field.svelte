<script lang="ts" generics="T extends Record">
  import { CheckIcon, ChevronsUpDownIcon } from "@lucide/svelte";
  import { Combobox } from "bits-ui";

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
    slotLabel,
    slotChoice,
    slotInfo,
    slotErrors,
  }: Props = $props();

  // Variables
  type Choice = LabelValue<string | number>;
  let filtering = $state(false);
  let filteredChoices = $state<LabelValue<string | number>[]>([]);

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

  function select(choice: Choice) {
    value = choice.value;
    onSelected?.(value);
  }
</script>

<Field id={name} class={cn("", className)}>
  {#if slotLabel}
    {@render slotLabel()}
  {:else}
    <FieldLabel for={name} {required}>{label}</FieldLabel>
  {/if}

  <Combobox.Root type="single">
    <div class="relative">
      <Combobox.Input
        class={cn(
          "selection:bg-primary dark:bg-input/30 selection:text-primary-foreground border-input ring-offset-background placeholder:text-muted-foreground flex h-9 w-full min-w-0 rounded-md border bg-transparent px-3 text-sm font-medium shadow-xs transition-[color,box-shadow] outline-none disabled:cursor-not-allowed disabled:opacity-50",
          "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
          "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        )}
        oninput={(e) => {
          filterChoices(e.currentTarget.value);
          onSelected?.(e.currentTarget.value);
        }}
        autofocus={false}
        {disabled}
        {placeholder}
      ></Combobox.Input>

      <Combobox.Trigger class="absolute end-2 top-1/2 size-4 -translate-y-1/2 touch-none">
        <ChevronsUpDownIcon class="text-muted-foreground size-4" />
      </Combobox.Trigger>
    </div>

    <Combobox.Portal>
      <Combobox.Content
        class="focus-override border-muted bg-background shadow-popover data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 h-96 max-h-[var(--bits-combobox-content-available-height)] w-auto min-w-[var(--bits-combobox-anchor-width)] rounded-lg border p-1 outline-hidden select-none data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1"
        sideOffset={4}
      >
        <Combobox.Viewport class="p-1">
          {#each filteredChoices as choice (choice.value)}
            {@const isSelected = choice.value === value}
            {#if slotChoice}
              {@render slotChoice({ choice, select })}
            {:else}
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
                onclick={() => select(choice)}
              >
                {choice.label}

                {#if isSelected}
                  <div class="ml-auto">
                    <CheckIcon class="size-4" />
                  </div>
                {/if}
              </Combobox.Item>
            {/if}
          {:else}
            {#if filtering}
              <Spinner class="mx-auto h-full" />
            {:else}
              <span class="block p-2 text-sm text-muted-foreground"> No results found. </span>
            {/if}
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
