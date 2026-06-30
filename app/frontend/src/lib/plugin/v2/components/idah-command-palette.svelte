<script lang="ts">
  // -----------------------------------------------------------------------
  // IdahCommandPalette.svelte — Command palette for the V2 mock page
  //
  // Shows all keyboard shortcuts available in the current mode.
  // Toggled via Ctrl+Space (handled by the parent, we just react to `open`).
  // -----------------------------------------------------------------------
  import { RotateCcwIcon } from "@lucide/svelte";

  import * as Command from "$lib/components/ui/command";
  import * as Dialog from "$lib/components/ui/dialog";

  import Button from "@/components/ui/button/button.svelte";
  import CommandShortcutItem from "./_CommandShortcutItem.svelte";

  import type { IAccountSettingsDriverV2, ICommandDriverV2 } from "$lib/plugin/v2/types";

  interface Props {
    open: boolean;
    onOpenChange?: (open: boolean) => void;
    commandManager: ICommandDriverV2;
    mode: string;
    searchValue?: string;
    accountSettings: IAccountSettingsDriverV2;
  }

  let {
    open = $bindable(false),
    onOpenChange,
    commandManager,
    mode,
    searchValue = $bindable(""),
    accountSettings,
  }: Props = $props();
</script>

<Dialog.Root bind:open {onOpenChange}>
  <Dialog.Content class="lg:min-w-[40vw]">
    <Dialog.Header>
      <Dialog.Title>Shortcuts</Dialog.Title>
    </Dialog.Header>

    <Command.Root>
      <Command.Input placeholder="Type a command or search..." />

      <Command.List class="min-h-[60vh] overflow-y-auto">
        <Command.Empty>No results found.</Command.Empty>

        {#each Array.from(commandManager
            .getAllCommands(mode)
            .entries()).sort(([a], [b]) => a.localeCompare(b)) as [groupName, cmds], i (i)}
          <Command.Group heading={groupName}>
            {#each cmds
              .filter((c) => c.shortDescription)
              .sort( (a, b) => (a.shortDescription ?? a.name).localeCompare(b.shortDescription ?? b.name), ) as cmd (cmd.name)}
              <CommandShortcutItem
                {cmd}
                {commandManager}
                {accountSettings}
                {searchValue}
                onCommandCalled={() => (open = false)}
              />
            {/each}
          </Command.Group>
        {/each}
      </Command.List>
    </Command.Root>

    <Dialog.Footer>
      <Button variant="destructive-outline" onclick={() => accountSettings.resetAll()}>
        <RotateCcwIcon />
        Reset all to default
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
