<script lang="ts">
  import { MailIcon } from "@lucide/svelte";

  import { Button } from "@/components/ui/button";
  import { Item, ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@/components/ui/item";
</script>

<Item variant="outline">
  <ItemMedia variant="icon">
    <MailIcon />
  </ItemMedia>

  <ItemContent class="gap-0">
    <ItemTitle>Email</ItemTitle>
    <ItemDescription class="text-xs">1 unverified emails configured</ItemDescription>
  </ItemContent>

  <ItemActions>
    <Button variant="outline" size="sm">Manage</Button>
  </ItemActions>
</Item>
