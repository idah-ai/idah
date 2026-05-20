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
  } from "$lib/components/ui/command";
  import Highlight from "$lib/components/ui/Highlight.svelte";
  import { getShortcuts } from "$lib/components/ui/kbd/utils";
  import type { ICommandDriverV2 } from "$lib/plugin/v2/types";

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
    {#each Array.from(commandManager
        .getAllCommands(mode)
        .entries()).sort(([a], [b]) => a.localeCompare(b)) as [groupName, cmds], i (i)}
      <CommandGroup heading={groupName}>
        {#each cmds
          .filter((c) => c.shortDescription)
          .sort((a, b) => (a.shortDescription ?? a.name).localeCompare(b.shortDescription ?? b.name)) as cmd (cmd.name)}
          <CommandItem
            value={cmd.shortDescription ?? cmd.name}
            title={cmd.longDescription ?? cmd.shortDescription ?? ""}
            onSelect={() => {
              commandManager.call(cmd.name);
              open = false;
            }}
          >
            <span class="palette-item-label">
              <Highlight text={cmd.shortDescription} query={searchValue} />
              {#if cmd.longDescription}
                <span class="palette-item-desc">{cmd.longDescription}</span>
              {/if}
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

<style>
  :global(.palette-item-label) {
    font-size: 0.8rem;
    line-height: 1.2;
  }

  :global(.palette-item-desc) {
    font-size: 0.65rem;
    opacity: 0.6;
    margin-left: 0.5rem;
  }
</style>
