<script lang="ts">
  import { type Icon as IconType } from "@lucide/svelte";
  import type { Snippet } from "svelte";

  import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

  import { cn } from "@/utils";

  // Props
  interface Props {
    icon?: typeof IconType;

    title: string;
    description: string;

    class?: string | null;
    actions?: Snippet;
  }
  let { icon: Icon, title, description, class: className, actions }: Props = $props();
</script>

<Empty class={cn("", className)}>
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
    {@render actions?.()}
  </EmptyContent>
</Empty>
