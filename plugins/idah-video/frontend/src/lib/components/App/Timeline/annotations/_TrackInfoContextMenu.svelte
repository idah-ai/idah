<script lang="ts">
  import Button from "$lib/components/ui/Button/Button.svelte";
  import Separator from "$lib/components/ui/Separator/Separator.svelte";

  import { getGroupContextMenus } from "$lib/components/App/Timeline/annotations/menus";

  import type { ContextMenuComponentProps } from "$lib/components/App/ContextMenu/store";
  import type { TrackData } from "$lib/components/App/Timeline/types";

  // Props
  interface Props extends ContextMenuComponentProps {
    track: TrackData;
  }
  let { track }: Props = $props();

  // Variables
  let menus = $derived(getGroupContextMenus({ track }));
</script>

<div class="bg-background my-1 flex flex-col">
  {#each Object.entries(menus) as [groupKey, group], groupIndex (groupKey)}
    {@const isLastGroup = Object.keys(menus).length - 1 === groupIndex}

    {#each Object.entries(group.items) as [menuKey, { label, icon: Icon, disabled, hidden, destructive, onClick }] (menuKey)}
      {#if !hidden}
        <Button
          variant={destructive ? "destructive-ghost" : "ghost"}
          size="sm"
          class="mx-1 justify-start"
          {disabled}
          onclick={onClick}
        >
          <Icon />
          {label}
        </Button>
      {/if}
    {/each}

    {#if !isLastGroup && Object.keys(group.items).length > 0}
      <Separator class="my-1" />
    {/if}
  {/each}
</div>
