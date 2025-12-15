<script lang="ts">
  import { CheckIcon, ChevronsUpDownIcon, CircleXIcon } from "@lucide/svelte";

  import Badge from "@/components/ui/badge/badge.svelte";
  import Button from "@/components/ui/button/button.svelte";
  import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
  import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
  import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

  import { cn } from "@/utils";

  import type { MultipleSelectFieldBaseProps } from "@/components/app/forms/form-field.types";
  import type { LabelValue } from "@/components/app/types";

  // Props
  interface Props extends MultipleSelectFieldBaseProps {
    values: Array<string | number | null>;
  }
  let {
    choices,
    // hiddenChoices = [],
    // disabledChoices = [],
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
    onSelected,
    slotLabel,
    slotChoice,
    slotInfo,
    slotErrors,
  }: Props = $props();

  // Variables
  let open: boolean = $state(false);
  let selectedValues = $derived(choices.filter((choice) => values.includes(choice.value)));

  // Functions
  async function select(choice: LabelValue<string | number>): Promise<void> {
    if (values.includes(choice.value)) {
      values = values.filter((value) => value !== choice.value);
    } else {
      values = [...values, choice.value];
    }
    open = false;
    await onSelected?.(selectedValues);
  }

  function clearSelection(event: MouseEvent): void {
    event.stopPropagation();
    values = [];
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
      {#snippet child({ props })}
        <Button variant="outline" class="justify-between" role="combobox" {disabled} aria-expanded={open} {...props}>
          {#if selectedValues.length > 0}
            {#each selectedValues as selected, index (index)}
              <Badge>{selected.label}</Badge>
            {/each}
          {:else}
            <span class="text-muted-foreground">{placeholder}</span>
          {/if}

          <div class={cn("ml-auto inline-flex items-center gap-2")}>
            <button
              type="button"
              class={cn("cursor-pointer", clearable && selectedValues ? "opacity-50" : "opacity-0")}
              onclick={clearSelection}
            >
              <CircleXIcon class="size-4 shrink-0"></CircleXIcon>
            </button>

            <ChevronsUpDownIcon class="size-4 shrink-0 opacity-50"></ChevronsUpDownIcon>
          </div>
        </Button>
      {/snippet}
    </PopoverTrigger>

    <PopoverContent align="start" class="w-auto min-w-[var(--bits-floating-anchor-width)] p-0">
      <Command>
        {#if searchable}
          <CommandInput placeholder={searchPlaceholder}></CommandInput>
        {/if}

        <CommandList>
          <CommandEmpty>No option found.</CommandEmpty>
          <CommandGroup>
            {#each choices as choice (choice.value)}
              {#if slotChoice}
                {@render slotChoice({ choice, select })}
              {:else}
                <CommandItem value={String(choice.value)} onSelect={() => select(choice)}>
                  <CheckIcon
                    class={cn("mr-2 size-4", {
                      "opacity-0": !values.includes(choice.value),
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
