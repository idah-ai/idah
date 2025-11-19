<script lang="ts">
  import { CheckIcon, ChevronsUpDownIcon, CircleXIcon } from "@lucide/svelte";

  import Button from "@/components/ui/button/button.svelte";
  import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
  import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
  import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

  import { cn } from "@/utils";

  import type { SingleSelectFieldBaseProps } from "@/components/app/forms/form-field.types";
  import type { LabelValue } from "@/components/app/types";

  // Props
  interface Props extends SingleSelectFieldBaseProps {
    value: string | number | null;
  }
  let {
    choices,
    value = $bindable(null),
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
    slotInfo,
    slotErrors,
  }: Props = $props();

  // Variables
  let open: boolean = $state(false);
  let selectedValue = $derived(choices.find((choice) => choice.value == value));

  // Functions
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
        "ring-destructive ring-1": (errors?.length ?? 0) > 0,
      })}
    >
      {#snippet child({ props })}
        <Button
          variant="outline"
          class={cn("justify-between", {})}
          {disabled}
          role="combobox"
          aria-expanded={open}
          {...props}
        >
          {#if selectedValue}
            {selectedValue.label}
          {:else}
            <span class="text-muted-foreground">{placeholder}</span>
          {/if}

          <div class={cn("ml-auto inline-flex items-center gap-2")}>
            <button
              type="button"
              class={cn("cursor-pointer", clearable && selectedValue ? "opacity-50" : "opacity-0")}
              onclick={clearSelection}
            >
              <CircleXIcon class="size-4 shrink-0" />
            </button>

            <ChevronsUpDownIcon class="size-4 shrink-0 opacity-50"></ChevronsUpDownIcon>
          </div>
        </Button>
      {/snippet}
    </PopoverTrigger>

    <PopoverContent align="start" class="p-0">
      <Command>
        {#if searchable}
          <CommandInput placeholder={searchPlaceholder}></CommandInput>
        {/if}

        <CommandList>
          <CommandEmpty>No option found.</CommandEmpty>
          <CommandGroup>
            {#each choices as choice (choice.value)}
              <CommandItem value={String(choice.value)} onSelect={() => select(choice)}>
                <CheckIcon
                  class={cn("mr-2 size-4", {
                    "opacity-0": choice.value !== value,
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
  {:else if info}
    <FieldDescription>{info}</FieldDescription>
  {/if}

  {#if slotErrors}
    {@render slotErrors()}
  {:else if errors}
    <FieldError>{errors}</FieldError>
  {/if}
</Field>
