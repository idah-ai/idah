<script lang="ts">
  import { Item, ItemContent } from "@/components/ui/item";
  import Text from "@/components/ui/text/Text.svelte";

  // Props
  interface Props {
    name: string;
    info: string;
  }
  let { name, info }: Props = $props();
</script>

<Item variant="outline">
  <ItemContent>
    <div class="flex w-full items-start gap-4">
      <div class="flex flex-col gap-0">
        <Text size="sm" weight="semibold">{name}</Text>
        <Text size="sm" weight="normal" class="text-muted-foreground">{info}</Text>
      </div>

      <div class="ml-auto">
        <!-- ICON::SUCCESS::CHECK -->
        <!-- ICON::WARNING::ALERT TRIANGLE -->
        <!-- ICON::ERROR::X CIRCLE -->
      </div>
    </div>

    <div>
      <!-- PROGRESS BAR -->
      <!-- PROGRESS COUNT -->
    </div>
  </ItemContent>
</Item>
