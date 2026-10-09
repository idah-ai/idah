<script lang="ts">
  import { ChevronsUpDownIcon, CircleXIcon } from "@lucide/svelte";
  import { onMount } from "svelte";
  import { SvelteMap } from "svelte/reactivity";

  import { Badge } from "@/components/ui/badge";
  import Button from "@/components/ui/button/button.svelte";
  import Checkbox from "@/components/ui/checkbox/checkbox.svelte";
  import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
  import { Field, FieldError, FieldLabel } from "@/components/ui/field";
  import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

  import { webhooksBackendDataSource } from "@/data/model/notification/webhooks/record";
  import { cn } from "@/utils";
  import { humanize } from "@/utils/string";

  import type { WebhookEventRecord } from "@/data/model/notification/webhooks/event/record";

  interface Choice {
    label: string;
    value: string;
    data: WebhookEventRecord;
  }

  interface GroupedChoices {
    [service: string]: {
      [table: string]: Choice[];
    };
  }

  interface Props {
    name: string;
    label?: string;
    placeholder?: string;
    required?: boolean;
    errors?: string | string[];
    values: string[];
  }

  let {
    name,
    label = "Event Types",
    placeholder = "Select event types",
    required = false,
    errors,
    values = $bindable([]),
  }: Props = $props();

  let open = $state(false);
  let searchValue = $state("");
  let choices = $state<Choice[]>([]);
  let loading = $state(true);

  let selectedChoices = $derived(choices.filter((choice) => values.includes(choice.value)));
  let filteredChoices = $derived(
    searchValue.trim()
      ? choices.filter((choice) => {
          const keyword = searchValue.toLowerCase();
          return choice.label.toLowerCase().includes(keyword) || choice.value.toLowerCase().includes(keyword);
        })
      : choices,
  );
  let groupedChoices = $derived(groupChoices(filteredChoices));

  onMount(async () => {
    await loadEvents();
  });

  async function loadEvents(): Promise<void> {
    loading = true;

    try {
      const eventsRes = await webhooksBackendDataSource.event();
      const choicesByValue = new SvelteMap<string, Choice>();

      eventsRes.data.forEach((event) => {
        if (choicesByValue.has(event.event)) return;

        choicesByValue.set(event.event, {
          label: event.label,
          value: event.event,
          data: event,
        });
      });

      choices = Array.from(choicesByValue.values());
    } finally {
      loading = false;
    }
  }

  function groupChoices(items: Choice[]): GroupedChoices {
    return items.reduce((acc, choice) => {
      const [service, table, ...actionParts] = choice.value.split(":");
      const action = actionParts.join(":");

      if (!service || !table || !action) return acc;

      acc[service] ||= {};
      acc[service][table] ||= [];
      acc[service][table].push(choice);

      return acc;
    }, {} as GroupedChoices);
  }

  function toggleChoice(choice: Choice): void {
    if (values.includes(choice.value)) {
      values = values.filter((value) => value !== choice.value);
    } else {
      values = [...values, choice.value];
    }
  }

  function clearSelection(event: MouseEvent): void {
    event.stopPropagation();
    values = [];
  }
</script>

<Field id={name}>
  <FieldLabel for={name} {required}>{label}</FieldLabel>

  <Popover bind:open>
    <PopoverTrigger
      class={cn("w-full justify-between", {
        "border-destructive border-1": errors,
      })}
    >
      <Button variant="outline" class="w-full justify-between" role="combobox" aria-expanded={open}>
        {#if selectedChoices.length > 0}
          <div class="flex min-w-0 flex-wrap items-center gap-1">
            {#each selectedChoices.slice(0, 1) as choice (choice.value)}
              <Badge variant="outline" rounded="full">{choice.label}</Badge>
            {/each}

            {#if selectedChoices.length > 1}
              <Badge variant="outline" rounded="full">+{selectedChoices.length - 1} more</Badge>
            {/if}
          </div>
        {:else}
          <span class="text-muted-foreground">{placeholder}</span>
        {/if}

        <div class="ml-auto inline-flex items-center gap-2">
          <button
            type="button"
            class={cn("cursor-pointer", selectedChoices.length > 0 ? "opacity-50" : "pointer-events-none opacity-0")}
            tabindex={selectedChoices.length > 0 ? 0 : -1}
            aria-hidden={selectedChoices.length === 0}
            onclick={clearSelection}
          >
            <CircleXIcon class="size-4 shrink-0" />
          </button>

          <ChevronsUpDownIcon class="size-4 shrink-0 opacity-50" />
        </div>
      </Button>
    </PopoverTrigger>

    <PopoverContent align="start" class="w-auto min-w-[var(--bits-floating-anchor-width)] p-0">
      <Command>
        <CommandInput bind:value={searchValue} placeholder="Search event types by name" />

        <CommandList>
          {#if loading}
            <div class="text-muted-foreground p-3 text-sm">Loading event types...</div>
          {:else}
            <CommandEmpty>No event type found.</CommandEmpty>

            {#each Object.entries(groupedChoices) as [service, tables] (service)}
              <CommandGroup>
                <div class="text-muted-foreground px-2 pt-2 pb-1 text-xs font-semibold tracking-wide uppercase">
                  {humanize(service)}
                </div>

                {#each Object.entries(tables) as [table, tableChoices] (table)}
                  <div class="text-muted-foreground px-6 pt-2 pb-1 text-xs font-semibold tracking-wide uppercase">
                    {humanize(table)}
                  </div>

                  {#each tableChoices as choice (choice.value)}
                    <CommandItem value={choice.value} onclick={() => toggleChoice(choice)} class="pl-10">
                      <Checkbox
                        checked={values.includes(choice.value)}
                        onclick={(event) => event.stopPropagation()}
                        onCheckedChange={() => toggleChoice(choice)}
                      />

                      {choice.label}
                    </CommandItem>
                  {/each}
                {/each}
              </CommandGroup>
            {/each}
          {/if}
        </CommandList>
      </Command>
    </PopoverContent>
  </Popover>

  {#if errors}
    <FieldError>{errors}</FieldError>
  {/if}
</Field>
