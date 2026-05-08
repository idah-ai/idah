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
    CommandSeparator,
    CommandShortcut,
  } from "$lib/components/ui/Command";
  import { getShortcuts } from "$lib/components/ui/Kbd/utils";
  import type { ICommandDriverV2 } from "$idah/v2/types";

  interface Props {
    open: boolean;
    onOpenChange?: (open: boolean) => void;
    commandManager: ICommandDriverV2;
    mode: string;
  }

  let { open = $bindable(false), onOpenChange, commandManager, mode }: Props = $props();
</script>

<CommandDialog bind:open {onOpenChange} accesskey={mode}>
  <CommandInput placeholder="Type a command or search..." />
  <CommandList>
    <CommandEmpty>No results found.</CommandEmpty>
    <CommandGroup heading={mode}>
      {#each Object.entries(commandManager.getShortcutReferences()) as [name, value] (name)}
        {#if commandManager.getCommand(name)?.modes.includes(mode)}
          <CommandItem>
            <span>{value.label}</span>
            <CommandShortcut>
              {getShortcuts(value.keyCombinations)?.join(" or ")}
            </CommandShortcut>
          </CommandItem>
        {/if}
      {/each}
    </CommandGroup>
    <CommandSeparator />
  </CommandList>
</CommandDialog>
