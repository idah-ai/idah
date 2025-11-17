<script lang="ts">
  import { ChevronsUpDownIcon, FlagIcon } from "@lucide/svelte";

  import Badge from "@/components/ui/badge/badge.svelte";
  import { Command, CommandGroup, CommandItem } from "@/components/ui/command";
  import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

  import { entryPriorities } from "@/data/model/dataset/entries/constants";
  import { entriesBackendDataSource, EntryRecord } from "@/data/model/dataset/entries/record";
  import { cn } from "@/utils";
  import { refetches } from "@/utils/refetch";

  // Props
  interface Props {
    entry: EntryRecord;
    updatable?: boolean;
  }
  let { entry, updatable }: Props = $props();

  // Function
  async function changePriority(priorityValue: number) {
    await entriesBackendDataSource.update(entry.id, {
      attributes: {
        priority: priorityValue,
      },
    });
    $refetches.entries.list = new Date();
  }
</script>

{#snippet EntryPriorityBadge(props: { isDropdown: boolean } = { isDropdown: false })}
  {@const { isDropdown } = props}
  <Badge
    variant={entry.priorityBadge.variant}
    class={cn("", {
      "cursor-pointer": isDropdown,
    })}
  >
    <FlagIcon class="size-4"></FlagIcon>

    {entry.priorityBadge.label}

    {#if isDropdown}
      <ChevronsUpDownIcon class="size-4"></ChevronsUpDownIcon>
    {/if}
  </Badge>
{/snippet}

{#if updatable}
  <Popover>
    <PopoverTrigger>
      {@render EntryPriorityBadge({ isDropdown: true })}
    </PopoverTrigger>

    <PopoverContent align="center" class="max-w-40 p-0">
      <Command>
        <CommandGroup heading="Entry Priority">
          {#each entryPriorities as { label, value, iconColor } (value)}
            <CommandItem onclick={() => changePriority(value)}>
              <FlagIcon class="size-4" color={iconColor} fill={iconColor} />
              {label}
            </CommandItem>
          {/each}
        </CommandGroup>
      </Command>
    </PopoverContent>
  </Popover>
{:else}
  {@render EntryPriorityBadge()}
{/if}
