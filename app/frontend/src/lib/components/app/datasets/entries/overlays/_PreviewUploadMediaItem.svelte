<script lang="ts">
  import { Trash2Icon } from "@lucide/svelte";

  import { Button } from "@/components/ui/button";
  import { Item, ItemActions, ItemContent } from "@/components/ui/item";

  // Props
  interface Props {
    name: string;
    onDelete: () => void;
  }
  let { name, onDelete }: Props = $props();
</script>

<Item variant="outline">
  <ItemContent class="text-sm font-semibold">
    {name}
  </ItemContent>

  <ItemActions>
    <Button variant="destructive-ghost" size="icon-sm" onclick={onDelete}>
      <Trash2Icon />
    </Button>
  </ItemActions>
</Item>
