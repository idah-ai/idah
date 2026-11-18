<script lang="ts">
  import { MessageSquareIcon } from "@lucide/svelte";

  import * as Item from "@/components/ui/item/index";
  import Skeleton from "@/components/ui/skeleton/skeleton.svelte";
</script>

<Item.Root class="border-b-border rounded-none py-2 last:rounded-b-xl last:border-b-0">
  <Item.Media variant="icon">
    <MessageSquareIcon class="shrink-0" />
  </Item.Media>

  <Item.Content>
    <Item.Title>
      <Skeleton class="h-3 w-52" />
    </Item.Title>

    <Item.Description>
      <Skeleton class="h-2 w-64" />
    </Item.Description>
  </Item.Content>

  <Item.Actions>
    <Skeleton class="size-6" />
  </Item.Actions>
</Item.Root>
