<script lang="ts">
  import { type Icon as IconType } from "@lucide/svelte";
  import type { Snippet } from "svelte";

  import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

  // Props
  interface Props {
    icon?: typeof IconType;

    title: string;
    description: string;

    actions: Snippet;
  }
  let { icon: Icon, title, description, actions }: Props = $props();
</script>

<Empty>
  <EmptyHeader>
    <EmptyMedia variant={Icon ? "icon" : "default"}>
      {#if Icon}
        <Icon class="size-4"></Icon>
      {/if}
    </EmptyMedia>

    <EmptyTitle>{title}</EmptyTitle>

    <EmptyDescription>{description}</EmptyDescription>
  </EmptyHeader>

  <EmptyContent class="flex-row justify-center">
    {@render actions()}
  </EmptyContent>
</Empty>
