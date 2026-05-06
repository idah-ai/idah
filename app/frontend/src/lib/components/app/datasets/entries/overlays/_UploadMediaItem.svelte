<script lang="ts">
  import { ChevronDownIcon, ChevronRightIcon } from "@lucide/svelte";

  import Badge from "@/components/ui/badge/badge.svelte";
  import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
  import { Item, ItemContent } from "@/components/ui/item";
  import { Progress } from "@/components/ui/progress";
  import Text from "@/components/ui/text/Text.svelte";

  import { cn } from "@/utils";

  // Props
  interface Props {
    name: string;
    info: string;
  }
  let { name, info }: Props = $props();

  // Variables
  let openCollapsible = $state(false);
</script>

<Item variant="outline" class="rounded-xl">
  <ItemContent>
    <div class="flex w-full items-start gap-4">
      <div class="flex flex-col gap-0">
        <Text size="sm" weight="semibold">{name}</Text>
        <Text size="sm" weight="normal" class="text-muted-foreground">{info}</Text>
      </div>

      <div class="ml-auto">
        <!-- ICON::SUCCESS::CHECK -->
        <Badge variant="success" rounded="full" class="text-xs">Success</Badge>

        <!-- ICON::WARNING::ALERT TRIANGLE -->
        <Badge variant="warning" rounded="full" class="text-xs">Some are failes</Badge>

        <!-- ICON::ERROR::X CIRCLE -->
        <Badge variant="destructive" rounded="full" class="text-xs">Error</Badge>
      </div>
    </div>

    <div class="flex items-center gap-2">
      <!-- PROGRESS BAR -->
      <Progress value={100} />
      <!-- PROGRESS COUNT -->
      <Text size="sm" class="text-muted-foreground whitespace-nowrap">1/8</Text>
    </div>

    <Collapsible bind:open={openCollapsible}>
      <CollapsibleTrigger
        class={cn(
          "flex w-full cursor-pointer items-center rounded-sm p-2 hover:bg-amber-100 focus:outline-none hover:dark:bg-amber-900",
          {
            "rounded-br-none rounded-bl-none dark:bg-amber-900": openCollapsible,
          },
        )}
      >
        Failed files

        <div class="ml-auto">
          {#if openCollapsible}
            <ChevronDownIcon class="size-4" />
          {:else}
            <ChevronRightIcon class="size-4" />
          {/if}
        </div>
      </CollapsibleTrigger>

      <CollapsibleContent class="flex flex-col gap-2 rounded-br-sm rounded-bl-sm p-2 dark:bg-amber-900">
        <div class="flex flex-col gap-0">
          <Text size="xs">video.mp4</Text>
          <Text size="xs" class="text-destructive">File type not supported</Text>
        </div>
      </CollapsibleContent>
    </Collapsible>
  </ItemContent>
</Item>
