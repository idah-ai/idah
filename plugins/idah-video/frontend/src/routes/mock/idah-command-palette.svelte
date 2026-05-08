<script lang="ts">
  // -----------------------------------------------------------------------
  // IdahCommandPalette.svelte — Command palette for the V2 mock page
  //
  // Shows all keyboard shortcuts available in the current mode.
  // Toggled via Ctrl+Space (handled by the parent, we just react to `open`).
  // -----------------------------------------------------------------------
  import {
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandShortcut,
  } from "$lib/components/ui/Command";
  import Highlight from "$lib/components/ui/Highlight.svelte";
  import { getShortcuts } from "$lib/components/ui/Kbd/utils";
  import type { ICommandDriverV2 } from "$idah/v2/types";

  interface Props {
    open: boolean;
    onOpenChange?: (open: boolean) => void;
    commandManager: ICommandDriverV2;
    mode: string;
    searchValue?: string;
  }

  let { open = $bindable(false), onOpenChange, commandManager, mode, searchValue = $bindable("") }: Props = $props();
</script>

<CommandDialog bind:open {onOpenChange} accesskey={mode} bind:value={searchValue}>
  <CommandInput placeholder="Type a command or search..." />
  <CommandList>
    <CommandEmpty>No results found.</CommandEmpty>
    {#each Array.from(commandManager.getAllCommands().entries()) as [groupName, cmds]}
      <CommandGroup heading={groupName}>
        {#each cmds.filter((c) => c.shortDescription) as cmd (cmd.name)}
          <CommandItem
            onSelect={() => { commandManager.call(cmd.name); open = false; }}
          >
            <span>
              <Highlight text={cmd.shortDescription} query={searchValue} />
            </span>
            <CommandShortcut>
              {#if cmd.shortcut}
                {getShortcuts([cmd.shortcut])?.join(" or ")}
              {/if}
            </CommandShortcut>
          </CommandItem>
        {/each}
      </CommandGroup>
    {/each}
  </CommandList>
</CommandDialog>
