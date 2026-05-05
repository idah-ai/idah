<script lang="ts">
  import { getContext } from "svelte";

  import Button from "$lib/components/ui/button/button.svelte";
  import Separator from "$lib/components/ui/separator/separator.svelte";

  import { getGroupContextMenus } from "$lib/plugin/video-annotation-activity/timeline/annotations/menus";

  import type { IActivityContext } from "$idah/context/activity-context";
  import type { ContextMenuComponentProps } from "$lib/plugin/video-annotation-activity/context-menu/context-menu.store";
  import type { TrackData } from "$lib/plugin/video-annotation-activity/timeline/types";

  // Contexts
  const context: IActivityContext = getContext("context");

  // Props
  interface Props extends ContextMenuComponentProps {
    track: TrackData;
  }
  let { track }: Props = $props();

  // Variables
  let menus = $derived(getGroupContextMenus({ context, track }));
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
