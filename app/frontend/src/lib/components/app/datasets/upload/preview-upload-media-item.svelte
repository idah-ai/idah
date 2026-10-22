<script lang="ts">
  import { Trash2Icon } from "@lucide/svelte";

  import { Button } from "@/components/ui/button";
  import { Item, ItemActions, ItemContent, ItemMedia } from "@/components/ui/item";

  import type { Component } from "svelte";

  // Props
  interface Props {
    name: string;
    icon?: Component;
    onDelete: () => void;
  }
  let { name, icon: Icon, onDelete }: Props = $props();
</script>

<Item variant="outline" class="rounded-xl">
  {#if Icon}
    <ItemMedia variant="icon">
      <Icon />
    </ItemMedia>
  {/if}

  <ItemContent class="text-sm font-semibold">
    {name}
  </ItemContent>

  <ItemActions>
    <Button variant="destructive-ghost" size="icon-sm" onclick={onDelete}>
      <Trash2Icon />
    </Button>
  </ItemActions>
</Item>
