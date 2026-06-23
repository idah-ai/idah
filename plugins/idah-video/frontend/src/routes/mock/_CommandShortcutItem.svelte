<script lang="ts">
  import { PlusIcon, RotateCcwIcon } from "@lucide/svelte";

  import * as Command from "$lib/components/ui/Command";
  import * as Kbd from "$lib/components/ui/Kbd";

  import Highlight from "$lib/components/ui/Highlight.svelte";
  import Button from "$lib/components/ui/Button/Button.svelte";
  import Separator from "$lib/components/ui/Separator/Separator.svelte";
  import Tooltips from "$lib/components/ui/Tooltips/Tooltips.svelte";

  import { cn } from "$lib/utils";
  import { getShortcutLabel } from "$lib/components/ui/Kbd/utils";
  import { buildKeyCombination } from "./shortcut-utils";

  import type { IAccountSettingsDriverV2, ICommandDescriptor, ICommandDriverV2 } from "$idah/v2/types";

  interface Props {
    cmd: ICommandDescriptor;
    commandManager: ICommandDriverV2;
    accountSettings: IAccountSettingsDriverV2;
    searchValue: string;
    onCommandCalled: () => void;
  }
  let { cmd, commandManager, accountSettings, searchValue, onCommandCalled }: Props = $props();

  // Displayed shortcut = user override (live, reactive) if set, else the shipped
  // default. Deriving from the reactive override map means both per-item reset
  // and "Reset all to default" refresh this row's key automatically.
  let displayShortcut = $derived(accountSettings.getShortcutOverrides()[cmd.name] ?? cmd.shortcut);
  let listeningForShortcutPress = $state(false);
  let assignKeys = $state("");
  // Conflict is checked against the *active* shortcut: the in-progress combo
  // while recording, otherwise the saved/displayed binding — so the warning
  // surfaces both during recording and at rest.
  let activeShortcut = $derived(listeningForShortcutPress ? assignKeys : (displayShortcut ?? ""));
  let isConflict = $derived(checkConflict(activeShortcut));
  let containerRef = $state<HTMLElement | null>(null);

  function handleShortcutAssignment(e: MouseEvent) {
    e.stopPropagation();
    listeningForShortcutPress = true;
  }

  function checkConflict(shortcut: string): boolean {
    if (!shortcut) return false;
    const overrides = accountSettings.getShortcutOverrides();
    const all = commandManager.getAllCommands();
    for (const descriptors of all.values()) {
      for (const d of descriptors) {
        if (d.name === cmd.name) continue;
        if (!d.modes.some((m) => cmd.modes.includes(m))) continue; // same-mode only
        const effective = overrides[d.name] ?? d.shortcut; // compare against effective binding
        if (effective === shortcut) return true;
      }
    }
    return false;
  }

  $effect(() => {
    if (!listeningForShortcutPress) return;

    const onKeydown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.key === "Escape") {
        listeningForShortcutPress = false;
        assignKeys = "";
        return;
      }

      if (["Control", "Alt", "Shift", "Meta", "OS"].includes(e.key)) return;

      if (e.key === "Enter") {
        if (assignKeys) {
          // Persist the override. Conflicts are allowed (non-blocking) — the
          // warning is informational and the binding still saves.
          void accountSettings.setShortcut(cmd.name, assignKeys);
          listeningForShortcutPress = false;
          assignKeys = "";
        }
        return;
      }

      assignKeys = buildKeyCombination(e);
    };

    window.addEventListener("keydown", onKeydown, { capture: true });
    return () => window.removeEventListener("keydown", onKeydown, { capture: true });
  });

  $effect(() => {
    if (!listeningForShortcutPress) return;

    const onPointerDown = (e: PointerEvent) => {
      if (containerRef && !containerRef.contains(e.target as Node)) {
        if (assignKeys) {
          void accountSettings.setShortcut(cmd.name, assignKeys);
        }
        listeningForShortcutPress = false;
        assignKeys = "";
      }
    };

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  });
</script>

<Command.Item
  class="group/item aria-selected:bg-primary/5"
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

    {#if cmd.longDescription || listeningForShortcutPress}
      <span class="text-muted-foreground text-xs">
        {#if listeningForShortcutPress && isConflict}
          Conflict detected — shortcut already assigned to another command.
        {:else if listeningForShortcutPress}
          Listening for shortcut. "ENTER" to save, "ESC" to cancel recording.
        {:else}
          {cmd.longDescription}
        {/if}
      </span>
    {/if}
  </div>

  <div class="group ml-auto flex shrink-0 items-center gap-1" bind:this={containerRef}>
    <Tooltips align="center">
      {#snippet trigger()}
        <Button
          variant="ghost"
          size="icon-sm"
          class="opacity-0 group-hover/item:opacity-100"
          onclick={(e) => {
            e.stopPropagation();
            void accountSettings.resetShortcut(cmd.name);
          }}
        >
          <RotateCcwIcon />
        </Button>
      {/snippet}

      {#snippet content()}
        Reset default
      {/snippet}
    </Tooltips>

    {#if isConflict}
      <img src="/assets/icons/WarningIcon.svg" alt="Conflict" class="size-4 shrink-0" />
    {/if}

    {#if listeningForShortcutPress}
      <Button variant={isConflict ? "destructive-outline" : "outline"} size="sm" onclick={(e) => e.stopPropagation()}>
        {#if assignKeys}
          <Kbd.Group>
            {#each getShortcutLabel(assignKeys).split(" ") as key, i (i)}
              <Kbd.Root class={cn({ "bg-orange-200 text-orange-700": isConflict })}>{key}</Kbd.Root>
            {/each}
          </Kbd.Group>
        {:else}
          Press keys...
        {/if}
      </Button>
    {:else if displayShortcut}
      <Tooltips align="center">
        {#snippet trigger()}
          <Button variant="ghost" size="sm" class="hover:bg-primary/10 justify-end" onclick={handleShortcutAssignment}>
            <Kbd.Group>
              {#each getShortcutLabel(displayShortcut!).split(" ") as shortcutKey, i (i)}
                <Kbd.Root>{shortcutKey}</Kbd.Root>
              {/each}
            </Kbd.Group>
          </Button>
        {/snippet}

        {#snippet content()}
          Change shortcut
        {/snippet}
      </Tooltips>
    {:else}
      <Tooltips align="center">
        {#snippet trigger()}
          <Button variant="outline" size="sm" class="border-dashed" onclick={handleShortcutAssignment}>
            <PlusIcon />
            Add shortcut
          </Button>
        {/snippet}

        {#snippet content()}
          Add shortcut
        {/snippet}
      </Tooltips>
    {/if}
  </div>
</Command.Item>
<Separator />
