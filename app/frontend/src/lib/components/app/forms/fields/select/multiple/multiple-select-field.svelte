<script lang="ts">
  import Button from "@/components/ui/button/button.svelte";
  import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
  import FormField from "@/components/app/forms/form-field.svelte";
  import FormFieldErrors from "@/components/app/forms/form-field-errors.svelte";
  import FormFieldInfo from "@/components/app/forms/form-field-info.svelte";
  import FormFieldLabel from "@/components/app/forms/form-field-label.svelte";
  import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

  import { cn } from "@/utils";
  import { CheckIcon, ChevronsUpDownIcon, CircleXIcon, RotateCcwIcon } from "@lucide/svelte";

  import type { SelectFieldBaseProps } from "@/components/app/forms/form-field.types";
  import type { LabelValue } from "@/components/app/component.types";
  import Badge from "@/components/ui/badge/badge.svelte";

  // Props
  interface Props extends SelectFieldBaseProps {
    values: Array<string | number | null>;
  }
  let {
    choices,
    values = $bindable([]),
    name,
    label,
    placeholder = "Select an option",
    searchable = false,
    searchPlaceholder = "Search an option",
    clearable = false,
    disabled = false,
    required = false,
    info,
    errors,
    class: className,
    onValueChange,
    slotLabel,
    slotInfo,
    slotErrors,
  }: Props = $props();

  // Variables
  let open: boolean = $state(false);
  let selectedValues = $derived(choices.filter((choice) => values.includes(choice.value)));

  // Functions
  async function select(choice: LabelValue<string | number>): Promise<void> {
    // values = choice.value;
    if (values.includes(choice.value)) {
      values = values.filter((value) => value !== choice.value);
    } else {
      values = [...values, choice.value];
    }
    open = false;
  }

  function clearValue(event: MouseEvent): void {
    event.stopPropagation();
    values = [];
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
      {#snippet child({ props })}
        <Button variant="outline" class="justify-between" role="combobox" aria-expanded={open} {...props}>
          {#if selectedValues.length > 0}
            {#each selectedValues as selected}
              <Badge>{selected.label}</Badge>
            {/each}
          {:else}
            <span class="text-muted-foreground">{placeholder}</span>
          {/if}

          <div class={cn("ml-auto inline-flex items-center gap-2")}>
            <button
              type="button"
              class={cn("cursor-pointer", clearable && selectedValues ? "opacity-50" : "opacity-0")}
              onclick={clearValue}
            >
              <CircleXIcon class="size-4 shrink-0" />
            </button>

            <ChevronsUpDownIcon class="size-4 shrink-0 opacity-50" />
          </div>
        </Button>
      {/snippet}
    </PopoverTrigger>

    <PopoverContent align="start" class="p-0">
      <Command>
        {#if searchable}
          <CommandInput placeholder={searchPlaceholder} />
        {/if}

        <CommandList>
          <CommandEmpty>No option found.</CommandEmpty>
          <CommandGroup>
            {#each choices as choice (choice.value)}
              <CommandItem value={String(choice.value)} onSelect={() => select(choice)}>
                <CheckIcon
                  class={cn("mr-2 size-4", {
                    "opacity-0": !values.includes(choice.value),
                  })}
                />
                {choice.label}
              </CommandItem>
            {/each}
          </CommandGroup>
        </CommandList>
      </Command>
    </PopoverContent>
  </Popover>

  {#if slotInfo}
    {@render slotInfo()}
  {:else}
    <FormFieldInfo>{info}</FormFieldInfo>
  {/if}

  {#if slotErrors}
    {@render slotErrors()}
  {:else}
    <FormFieldErrors {errors}></FormFieldErrors>
  {/if}
</FormField>
