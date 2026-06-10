<script lang="ts">
  import * as Command from "$lib/components/ui/command";
  import * as Dialog from "$lib/components/ui/dialog";
  import Highlight from "$lib/components/ui/Highlight.svelte";
  import Button from "@/components/ui/button/button.svelte";
  import Separator from "@/components/ui/separator/separator.svelte";
  import Text from "@/components/ui/text/Text.svelte";
  import Input from "@/components/ui/input/input.svelte";

  import { cn } from "@/utils";
  import { getShortcutLabel } from "@/components/ui/kbd/utils";

  import type { ICommandDescriptor, ICommandDriverV2 } from "$lib/plugin/v2/types";

  interface Props {
    cmd: ICommandDescriptor;
    commandManager: ICommandDriverV2;
    searchValue: string;
    onCommandCalled: () => void;
  }
  let { cmd, commandManager, searchValue, onCommandCalled }: Props = $props();

  let assignKeys = $state("");
  let isConflict = $derived(checkConflict(cmd));
  let assignKeyBindingDialogOpen = $state(false);

  function handleClickAssignKeyBindingButton(e: MouseEvent) {
    e.stopPropagation();
    assignKeyBindingDialogOpen = true;
  }

  function handleShortcutAssignment(e: MouseEvent) {
    e.stopPropagation();
  }

  function checkConflict(cmd: ICommandDescriptor): boolean {
    // TODO: Implement shortcut key conflicts
    return false;
  }
</script>

<Command.Item
  class={cn("", {
    "bg-warning": isConflict,
  })}
  value={cmd.shortDescription ?? cmd.name}
  title={cmd.longDescription ?? cmd.shortDescription ?? ""}
  onSelect={() => {
    commandManager.call(cmd.name);
    onCommandCalled();
  }}
>
  <div class="flex flex-col">
    <div class="text-sm font-medium">
      <Highlight text={cmd.shortDescription} query={searchValue} />
    </div>

    {#if cmd.longDescription}
      <span class="text-muted-foreground text-xs">{cmd.longDescription}</span>
    {/if}
  </div>

  <Command.Shortcut>
    <Button
      variant="outline"
      size="sm"
      class={cn("w-40", {
        "bg-background": !cmd.shortcut,
        "bg-primary/10": cmd.shortcut,
        "bg-warning": isConflict,
      })}
      onclick={handleClickAssignKeyBindingButton}
    >
      {#if cmd.shortcut}
        {getShortcutLabel(cmd.shortcut)}
      {:else}
        Set key bind
      {/if}
    </Button>
  </Command.Shortcut>
</Command.Item>
<Separator />

<Dialog.Root bind:open={assignKeyBindingDialogOpen}>
  <Dialog.Content>
    <div class="flex w-full flex-col gap-4 text-center">
      <Text size="sm" class="text-muted-foreground">Press desired key combination then press ENTER</Text>

      <Input class="text-center" value={assignKeys} />

      <div class="rounded-md border-1 border-orange-500 bg-orange-100 p-2">
        <span class="text-sm">If there any conflicts of key bindings, we will list it here.</span>
      </div>
    </div>
  </Dialog.Content>
</Dialog.Root>
